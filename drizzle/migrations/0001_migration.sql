revoke all on public.qa_issues, public.invitations, public.user_roles, public.service_credentials from anon;
revoke execute on function public.has_role(uuid, public.app_role), public.is_member(uuid), public.owner_exists() from anon, public;
grant execute on function public.has_role(uuid, public.app_role), public.is_member(uuid), public.owner_exists() to authenticated;