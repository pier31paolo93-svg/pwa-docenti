-- Read-only release verification. Run on cloud only after migration 27 approval/application.
begin read only;
set local role postgres;
set local statement_timeout='30s';
do $$
declare actor record; allowed uuid[];
begin
 for actor in select id from public.profiles loop
  select array_agg(m.workspace_id) into allowed from public.workspace_members m join public.workspaces w on w.id=m.workspace_id where m.user_id=actor.id and m.revoked_at is null and w.deleted_at is null;
  perform set_config('request.jwt.claims','{}',true);
  perform set_config('request.jwt.claim.sub',actor.id::text,true);
  execute 'set local role authenticated';
  if exists(select 1 from public.timetable_versions v where not(v.workspace_id=any(coalesce(allowed,array[]::uuid[]))) or (private.member_role(v.workspace_id) not in ('owner','admin') and v.teacher_id<>actor.id)) then raise exception 'Timetable workspace/teacher isolation failed';end if;
  if exists(select 1 from public.timetable_slots s where not(s.workspace_id=any(coalesce(allowed,array[]::uuid[])))) then raise exception 'Timetable slot workspace isolation failed';end if;
  if exists(select 1 from public.timetable_exceptions e where not(e.workspace_id=any(coalesce(allowed,array[]::uuid[])))) then raise exception 'Timetable exception workspace isolation failed';end if;
  execute 'set local role postgres';
 end loop;
 perform set_config('request.jwt.claim.sub','',true);
 execute 'set local role authenticated';
 if exists(select 1 from public.timetable_versions) or exists(select 1 from public.timetable_slots) or exists(select 1 from public.timetable_exceptions) then raise exception 'Missing identity exposes timetable';end if;
 execute 'set local role postgres';
end $$;
with tables as(select c.* from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('timetable_versions','timetable_slots','timetable_exceptions')),
rpc as(select p.* from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('activate_timetable','duplicate_timetable','register_timetable_lesson')),
checks(name,passed) as(values
 ('migration 27 recorded',exists(select 1 from supabase_migrations.schema_migrations where version='20261024000100')),
 ('three tables with RLS',(select count(*)=3 and bool_and(relrowsecurity) from tables)),
 ('anonymous table access denied',not exists(select 1 from tables where has_table_privilege('anon',oid,'SELECT') or has_table_privilege('anon',oid,'INSERT') or has_table_privilege('anon',oid,'UPDATE'))),
 ('client hard delete denied',not exists(select 1 from tables where has_table_privilege('authenticated',oid,'DELETE'))),
 ('three invoker RPCs',(select count(*)=3 and bool_and(not prosecdef) from rpc)),
 ('RPC search paths safe',(select bool_and('search_path=""'=any(proconfig)) from rpc)),
 ('anonymous RPC calls denied',not exists(select 1 from rpc where has_function_privilege('anon',oid,'EXECUTE'))),
 ('PUBLIC RPC calls denied',not exists(select 1 from rpc cross join lateral aclexplode(proacl) a where a.grantee=0 and a.privilege_type='EXECUTE')),
 ('authenticated RPC calls granted',(select bool_and(has_function_privilege('authenticated',oid,'EXECUTE')) from rpc)),
 ('lesson occurrence index valid',exists(select 1 from pg_index where indexrelid='public.lessons_timetable_occurrence'::regclass and indisvalid and indisunique)),
 ('timetable FK constraints validated',not exists(select 1 from pg_constraint where conrelid in(select oid from tables) and not convalidated)),
 ('runtime workspace probes passed',true)
)
select jsonb_build_object('check_count',count(*),'passed',bool_and(coalesce(passed,false)),'checks',jsonb_agg(jsonb_build_object('name',name,'passed',coalesce(passed,false)) order by name),'migration_count',(select count(*) from supabase_migrations.schema_migrations)) verification from checks;
rollback;
