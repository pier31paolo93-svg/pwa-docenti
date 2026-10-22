-- Authorized migration 19: restrict only this view's API-role privileges.
revoke all on public.v_homework_completion from public,anon,authenticated;
grant select on public.v_homework_completion to authenticated;
