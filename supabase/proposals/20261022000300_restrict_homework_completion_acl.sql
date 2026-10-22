-- PROPOSAL ONLY. Outside migrations/: not applied by Supabase CLI.
-- Requires a separate authorization before any cloud execution.
-- Remove inherited table/view privileges and restore SELECT only.
revoke all on public.v_homework_completion from public,anon,authenticated;
grant select on public.v_homework_completion to authenticated;
