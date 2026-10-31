create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now(); new.reported_by = old.reported_by; new.agent_id = old.agent_id; new.source = old.source; new.created_at = old.created_at;
  if current_user <> 'service_role' then new.relayed_to = old.relayed_to; end if;
  return new;
end $$;

create or replace function public.audit_agent_admin() returns trigger language plpgsql security definer set search_path = public as $$
declare aid uuid; tgt text := null; d jsonb;
begin
  -- skip heartbeat-only updates (last_seen_at / last_used_at)
  if tg_op = 'UPDATE' then
    if tg_table_name = 'agents' and (to_jsonb(new) - 'last_seen_at') = (to_jsonb(old) - 'last_seen_at') then return new; end if;
    if tg_table_name = 'agent_credentials' and (to_jsonb(new) - 'last_used_at') = (to_jsonb(old) - 'last_used_at') then return new; end if;
  end if;
  if tg_table_name = 'agents' then aid := new.id; d := jsonb_build_object('name', new.name, 'status', new.status, 'duties', new.duties);
  elsif tg_table_name = 'agent_grants' then aid := new.agent_id; tgt := new.target; d := jsonb_build_object('grant', new.id, 'scopes', new.scopes, 'expires_at', new.expires_at, 'revoked_at', new.revoked_at);
  else aid := new.agent_id; d := jsonb_build_object('credential', new.id, 'prefix', new.token_prefix, 'expires_at', new.expires_at, 'revoked_at', new.revoked_at);
  end if;
  insert into public.agent_audit(agent_id, actor_user, action, target, outcome, detail)
  values (aid, auth.uid(), tg_table_name || '.' || lower(tg_op), tgt, 'ok', d);
  return new;
end $$;