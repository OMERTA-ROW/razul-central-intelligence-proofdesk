comment on table public.service_credentials is 'DEPRECATED: replaced by agents + agent_credentials + agent_grants';
revoke insert, update on public.service_credentials from authenticated;

create type public.agent_status as enum ('active','paused','revoked');

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(name) between 2 and 80),
  purpose text not null default '',
  duties text[] not null default array['qa_observer']::text[] check (duties <@ array['qa_observer','developer']::text[] and cardinality(duties) > 0),
  status public.agent_status not null default 'active',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
grant select, insert, update on public.agents to authenticated;
grant all on public.agents to service_role;
alter table public.agents enable row level security;
create policy "Owner reads agents" on public.agents for select to authenticated using (public.has_role(auth.uid(),'owner'));
create policy "Owner creates agents" on public.agents for insert to authenticated with check (public.has_role(auth.uid(),'owner') and created_by = auth.uid());
create policy "Owner updates agents" on public.agents for update to authenticated using (public.has_role(auth.uid(),'owner')) with check (public.has_role(auth.uid(),'owner'));

create table public.agent_credentials (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  token_prefix text not null,
  token_hash text not null unique,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz
);
grant select, insert, update on public.agent_credentials to authenticated;
grant all on public.agent_credentials to service_role;
alter table public.agent_credentials enable row level security;
create policy "Owner reads agent credentials" on public.agent_credentials for select to authenticated using (public.has_role(auth.uid(),'owner'));
create policy "Owner issues agent credentials" on public.agent_credentials for insert to authenticated with check (public.has_role(auth.uid(),'owner') and created_by = auth.uid());
create policy "Owner revokes agent credentials" on public.agent_credentials for update to authenticated using (public.has_role(auth.uid(),'owner')) with check (public.has_role(auth.uid(),'owner'));

create table public.agent_grants (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  target text not null check (target in ('razul-hub','anomaly-legacy','jackboy','omni')),
  scopes text[] not null check (cardinality(scopes) > 0 and scopes <@ array['qa:read','qa:report','dev:propose','dev:write']::text[]),
  granted_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
grant select, insert, update on public.agent_grants to authenticated;
grant all on public.agent_grants to service_role;
alter table public.agent_grants enable row level security;
create policy "Owner reads grants" on public.agent_grants for select to authenticated using (public.has_role(auth.uid(),'owner'));
create policy "Owner creates grants" on public.agent_grants for insert to authenticated with check (public.has_role(auth.uid(),'owner') and granted_by = auth.uid());
create policy "Owner revokes grants" on public.agent_grants for update to authenticated using (public.has_role(auth.uid(),'owner')) with check (public.has_role(auth.uid(),'owner'));

create or replace function public.check_grant_duties() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.scopes && array['dev:propose','dev:write']::text[])
     and not exists (select 1 from public.agents where id = new.agent_id and 'developer' = any(duties)) then
    raise exception 'dev scopes require an agent with the developer duty';
  end if;
  return new;
end $$;
create trigger agent_grants_duties before insert or update on public.agent_grants for each row execute function public.check_grant_duties();

create table public.agent_audit (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid,
  actor_user uuid,
  action text not null,
  target text,
  outcome text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.agent_audit to authenticated;
grant all on public.agent_audit to service_role;
alter table public.agent_audit enable row level security;
create policy "Owner reads audit" on public.agent_audit for select to authenticated using (public.has_role(auth.uid(),'owner'));

create or replace function public.audit_agent_admin() returns trigger language plpgsql security definer set search_path = public as $$
declare aid uuid; tgt text := null; d jsonb;
begin
  if tg_table_name = 'agents' then aid := new.id; d := jsonb_build_object('name', new.name, 'status', new.status, 'duties', new.duties);
  elsif tg_table_name = 'agent_grants' then aid := new.agent_id; tgt := new.target; d := jsonb_build_object('grant', new.id, 'scopes', new.scopes, 'expires_at', new.expires_at, 'revoked_at', new.revoked_at);
  else aid := new.agent_id; d := jsonb_build_object('credential', new.id, 'prefix', new.token_prefix, 'expires_at', new.expires_at, 'revoked_at', new.revoked_at);
  end if;
  insert into public.agent_audit(agent_id, actor_user, action, target, outcome, detail)
  values (aid, auth.uid(), tg_table_name || '.' || lower(tg_op), tgt, 'ok', d);
  return new;
end $$;
create trigger audit_agents after insert or update on public.agents for each row execute function public.audit_agent_admin();
create trigger audit_grants after insert or update on public.agent_grants for each row execute function public.audit_agent_admin();
create trigger audit_creds after insert or update on public.agent_credentials for each row execute function public.audit_agent_admin();

alter table public.qa_issues drop constraint if exists qa_issues_source_check;
alter table public.qa_issues alter column reported_by drop not null;
alter table public.qa_issues add column agent_id uuid references public.agents(id) on delete set null;
alter table public.qa_issues add constraint qa_issues_source_check check (
  (source = 'manual' and reported_by is not null) or (source = 'agent' and agent_id is not null));
alter table public.qa_issues add column relayed_to jsonb not null default '{}'::jsonb;

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); new.reported_by = old.reported_by; new.agent_id = old.agent_id; new.source = old.source; new.created_at = old.created_at; new.relayed_to = old.relayed_to; return new; end $$;