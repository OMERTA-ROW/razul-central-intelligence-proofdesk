-- Owner-only human access: reviewers no longer get console access.
create or replace function public.is_member(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = 'owner')
$$;
revoke execute on function public.redeem_invitation(text) from authenticated;
comment on table public.invitations is 'DEPRECATED: human platform login is owner-only; invitations disabled';
comment on function public.redeem_invitation(text) is 'DEPRECATED: disabled, owner-only access';

-- Agent working roles.
create type public.agent_role as enum ('sentinel','angeltech','demontech');
alter table public.agents add column role public.agent_role not null default 'sentinel';

-- Ecosystem targets and expanded scopes.
alter table public.agent_grants drop constraint if exists agent_grants_target_check;
alter table public.agent_grants add constraint agent_grants_target_check check (target in ('razul-hub','anomaly-legacy','jackboy','omni','guardian','jax'));
alter table public.agent_grants drop constraint if exists agent_grants_scopes_check;
alter table public.agent_grants add constraint agent_grants_scopes_check check (cardinality(scopes) > 0 and scopes <@ array[
  'qa:read','qa:report','memory:read','memory:write','tasks:read','tasks:report',
  'health:report','ops:routine','research:propose','security:inspect','dev:propose','dev:write']::text[]);

create or replace function public.check_grant_duties() returns trigger language plpgsql security definer set search_path = public as $$
declare a public.agents%rowtype;
begin
  select * into a from public.agents where id = new.agent_id;
  if (new.scopes && array['dev:propose','dev:write']::text[]) and not ('developer' = any(a.duties)) then
    raise exception 'dev scopes require an agent with the developer duty'; end if;
  if 'security:inspect' = any(new.scopes) and a.role <> 'demontech' then
    raise exception 'security:inspect is reserved for DemonTech agents'; end if;
  if 'research:propose' = any(new.scopes) and a.role <> 'angeltech' then
    raise exception 'research:propose is reserved for AngelTech agents'; end if;
  if (new.scopes && array['health:report','ops:routine']::text[]) and a.role <> 'sentinel' then
    raise exception 'health/ops scopes are reserved for Sentinel agents'; end if;
  return new;
end $$;

-- Persistent ecosystem memory / historical knowledge / reports.
create type public.knowledge_kind as enum ('observation','research','history','report','decision');
create type public.evidence_class as enum ('verified','primary_source','reported','observed','hypothesis','historical');
create table public.knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  kind public.knowledge_kind not null,
  project text not null default 'ecosystem' check (project in ('ecosystem','razul-hub','anomaly-legacy','jackboy','omni','guardian','jax')),
  title text not null check (length(title) between 3 and 300),
  body text not null default '' check (length(body) <= 20000),
  evidence public.evidence_class not null default 'observed',
  sources jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  occurred_at timestamptz,
  author_user uuid,
  agent_id uuid references public.agents(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint knowledge_author check (author_user is not null or agent_id is not null),
  constraint research_needs_sources check (kind <> 'research' or jsonb_array_length(sources) > 0)
);
create index knowledge_entries_project_idx on public.knowledge_entries(project, created_at desc);
grant select, insert, delete on public.knowledge_entries to authenticated;
grant all on public.knowledge_entries to service_role;
alter table public.knowledge_entries enable row level security;
create policy "Owner reads knowledge" on public.knowledge_entries for select to authenticated using (public.has_role(auth.uid(),'owner'));
create policy "Owner writes knowledge" on public.knowledge_entries for insert to authenticated with check (public.has_role(auth.uid(),'owner') and author_user = auth.uid() and agent_id is null);
create policy "Owner deletes knowledge" on public.knowledge_entries for delete to authenticated using (public.has_role(auth.uid(),'owner'));

-- Dispatcher: owner assigns tasks to agents; agents pull and report.
create type public.task_status as enum ('queued','acknowledged','in_progress','reported','failed','cancelled');
create table public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  target text not null check (target in ('razul-hub','anomaly-legacy','jackboy','omni','guardian','jax')),
  required_scope text not null,
  instruction text not null check (length(instruction) between 3 and 4000),
  status public.task_status not null default 'queued',
  result text,
  result_entry uuid references public.knowledge_entries(id) on delete set null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.agent_tasks to authenticated;
grant all on public.agent_tasks to service_role;
alter table public.agent_tasks enable row level security;
create policy "Owner reads tasks" on public.agent_tasks for select to authenticated using (public.has_role(auth.uid(),'owner'));
create policy "Owner creates tasks" on public.agent_tasks for insert to authenticated with check (public.has_role(auth.uid(),'owner') and created_by = auth.uid());
create policy "Owner updates tasks" on public.agent_tasks for update to authenticated using (public.has_role(auth.uid(),'owner')) with check (public.has_role(auth.uid(),'owner'));