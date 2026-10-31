create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('owner', 'reviewer');
create type public.issue_category as enum ('animation_snapping','foot_sliding','clipping','collision_mismatch','horse_chariot','performance_spike','multiplayer_desync','other');
create type public.issue_severity as enum ('blocker','critical','major','minor','trivial');
create type public.issue_status as enum ('new','triaged','in_progress','fixed','verified','wont_fix','duplicate');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_member(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id)
$$;
create or replace function public.owner_exists()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where role = 'owner')
$$;

create policy "Users read own roles; owner reads all" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'owner'));
create policy "Owner removes reviewer roles" on public.user_roles for delete to authenticated
  using (public.has_role(auth.uid(), 'owner') and role = 'reviewer');

-- Invitations (owner-controlled, reviewer role only)
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role public.app_role not null default 'reviewer',
  token_hash text not null unique,
  invited_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid,
  accepted_at timestamptz,
  revoked_at timestamptz,
  constraint invitations_reviewer_only check (role = 'reviewer'),
  constraint invitations_email_lower check (email = lower(email))
);
grant select, insert, update on public.invitations to authenticated;
grant all on public.invitations to service_role;
alter table public.invitations enable row level security;
create policy "Owner reads invitations" on public.invitations for select to authenticated using (public.has_role(auth.uid(),'owner'));
create policy "Owner creates invitations" on public.invitations for insert to authenticated with check (public.has_role(auth.uid(),'owner') and invited_by = auth.uid());
create policy "Owner revokes invitations" on public.invitations for update to authenticated using (public.has_role(auth.uid(),'owner')) with check (public.has_role(auth.uid(),'owner'));

create or replace function public.redeem_invitation(_token text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  inv public.invitations%rowtype;
  caller_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into inv from public.invitations
   where token_hash = encode(extensions.digest(_token, 'sha256'), 'hex') for update;
  if not found then raise exception 'invalid_invitation'; end if;
  if inv.revoked_at is not null then raise exception 'invitation_revoked'; end if;
  if inv.accepted_at is not null then raise exception 'invitation_used'; end if;
  if inv.expires_at < now() then raise exception 'invitation_expired'; end if;
  if inv.email <> caller_email then raise exception 'email_mismatch'; end if;
  insert into public.user_roles(user_id, role) values (auth.uid(), inv.role) on conflict do nothing;
  update public.invitations set accepted_by = auth.uid(), accepted_at = now() where id = inv.id;
  return inv.role::text;
end $$;
revoke all on function public.redeem_invitation(text) from public, anon;
grant execute on function public.redeem_invitation(text) to authenticated;

-- QA issues
create table public.qa_issues (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 3 and 200),
  category public.issue_category not null default 'other',
  severity public.issue_severity not null default 'major',
  status public.issue_status not null default 'new',
  build_version text not null check (length(build_version) between 1 and 100),
  platform text,
  expected_behavior text not null,
  observed_behavior text not null,
  repro_steps text not null,
  evidence_ref text,
  source text not null default 'manual' check (source in ('manual')),
  reported_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.qa_issues to authenticated;
grant all on public.qa_issues to service_role;
alter table public.qa_issues enable row level security;
create policy "Members read issues" on public.qa_issues for select to authenticated using (public.is_member(auth.uid()));
create policy "Members create issues" on public.qa_issues for insert to authenticated with check (public.is_member(auth.uid()) and reported_by = auth.uid());
create policy "Members update issues" on public.qa_issues for update to authenticated using (public.is_member(auth.uid())) with check (public.is_member(auth.uid()));
create policy "Owner deletes issues" on public.qa_issues for delete to authenticated using (public.has_role(auth.uid(),'owner'));

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); new.reported_by = old.reported_by; new.created_at = old.created_at; return new; end $$;
create trigger qa_issues_touch before update on public.qa_issues for each row execute function public.touch_updated_at();

-- Machine service credentials (design: hashed, scoped, revocable; no ingest endpoint accepts them yet)
create table public.service_credentials (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  scopes text[] not null default '{}',
  token_prefix text not null,
  token_hash text not null unique,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  constraint scopes_allowed check (scopes <@ array['evidence:write','telemetry:write','issues:read','issues:write']::text[])
);
grant select, insert, update on public.service_credentials to authenticated;
grant all on public.service_credentials to service_role;
alter table public.service_credentials enable row level security;
create policy "Owner reads credentials" on public.service_credentials for select to authenticated using (public.has_role(auth.uid(),'owner'));
create policy "Owner creates credentials" on public.service_credentials for insert to authenticated with check (public.has_role(auth.uid(),'owner') and created_by = auth.uid());
create policy "Owner revokes credentials" on public.service_credentials for update to authenticated using (public.has_role(auth.uid(),'owner')) with check (public.has_role(auth.uid(),'owner'));