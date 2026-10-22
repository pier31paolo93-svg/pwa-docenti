-- Non-destructive SQL authorization probes. Never creates fixtures or changes memberships.
-- Run only on the explicitly authorized project. Last SELECT returns the verification report.
begin read only;
set local statement_timeout='20s';
do $$
declare ctx record; target uuid; scopes uuid[]; expected jsonb; actual jsonb;
begin
 perform set_config('request.jwt.claims','{}',true);
 select array_agg(id order by id) into scopes from public.workspaces where deleted_at is null;
 if coalesce(cardinality(scopes),0)<2 then raise exception 'Two existing workspaces required for cross-workspace probes'; end if;
 for ctx in select w.id,w.owner_id from public.workspaces w join public.workspace_members m on m.workspace_id=w.id and m.user_id=w.owner_id where w.deleted_at is null and m.revoked_at is null and m.role='owner' order by w.id loop
  select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'display_name',p.display_name,'member_role',m.role) order by m.user_id),'[]') into expected
  from public.workspace_members m join public.profiles p on p.id=m.user_id where m.workspace_id=ctx.id and m.revoked_at is null and m.role in ('owner','admin','teacher');
  perform set_config('request.jwt.claim.sub',ctx.owner_id::text,true);
  execute 'set local role authenticated';
  select coalesce(jsonb_agg(to_jsonb(d) order by d.user_id),'[]') into actual from public.workspace_teacher_directory(ctx.id) d;
  if actual is distinct from expected then raise exception 'Owner directory differs from authorized same-workspace membership'; end if;
  foreach target in array scopes loop
   if target<>ctx.id then
    begin
     perform * from public.workspace_teacher_directory(target);
     raise exception 'Cross-workspace directory unexpectedly allowed';
    exception when insufficient_privilege then null;
    end;
   end if;
  end loop;
  begin
   perform * from public.workspace_teacher_directory(null);
   raise exception 'NULL workspace unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  begin
   perform * from public.workspace_teacher_directory('00000000-0000-4000-8000-000000000000');
   raise exception 'Unknown workspace unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub','',true);
  begin
   perform * from public.workspace_teacher_directory(ctx.id);
   raise exception 'Missing identity unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
 end loop;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000000',true);
 perform set_config('request.jwt.claims','{"role":"admin"}',true);
 execute 'set local role authenticated';
 foreach target in array scopes loop
  begin
   perform * from public.workspace_teacher_directory(target);
   raise exception 'Nonmember with an admin claim unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
 end loop;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub','',true);
 perform set_config('request.jwt.claims','{}',true);
 execute 'set local role anon';
 begin
  perform * from public.workspace_teacher_directory(scopes[1]);
  raise exception 'Anonymous directory unexpectedly allowed';
 exception when insufficient_privilege then null;
 end;
 execute 'reset role';
 execute 'set local role service_role';
 begin
  perform * from public.workspace_teacher_directory(scopes[1]);
  raise exception 'Privileged role without caller identity unexpectedly allowed';
 exception when insufficient_privilege then null;
 end;
 execute 'reset role';
end $$;
rollback;
-- A failed DO aborts execution before this SELECT; no personal records are returned.
with f as (select * from pg_proc where oid='public.workspace_teacher_directory(uuid)'::regprocedure), checks as (
 select '20 migrations including migration 20' name,(select count(*)=20 and count(*) filter(where version='20261022000400')=1 from supabase_migrations.schema_migrations) passed
 union all select 'Expected result columns',(select pg_get_function_result(oid)='TABLE(user_id uuid, display_name text, member_role text)' from f)
 union all select 'STABLE',(select provolatile='s' from f)
 union all select 'SECURITY DEFINER',(select prosecdef from f)
 union all select 'Empty search_path',(select 'search_path=""'=any(proconfig) from f)
 union all select 'No PUBLIC execute',not exists(select 1 from f cross join lateral aclexplode(coalesce(proacl,acldefault('f',proowner))) a where a.grantee=0)
 union all select 'Anonymous has no execute',not has_function_privilege('anon','public.workspace_teacher_directory(uuid)','EXECUTE')
 union all select 'Authenticated can invoke guarded RPC',has_function_privilege('authenticated','public.workspace_teacher_directory(uuid)','EXECUTE')
 union all select 'No auth.users or email lookup',(select prosrc not like '%auth.users%' and prosrc not like '%email%' from f)
 union all select 'Owner/Admin gate present',(select prosrc like '%private.member_role(p_workspace) is null%' and prosrc like '%not in (''owner'',''admin'')%' from f)
 union all select 'Membership result scope and role filters',(select prosrc like '%m.workspace_id=p_workspace%' and prosrc like '%m.revoked_at is null%' and prosrc like '%m.role in (''owner'',''admin'',''teacher'')%' from f)
 union all select 'Guard rejects revoked membership/deleted workspace',(select prosrc like '%auth.uid()%' and prosrc like '%revoked_at is null%' and prosrc like '%deleted_at is null%' from pg_proc where oid='private.member_role(uuid)'::regprocedure)
 union all select 'Profiles RLS remains enabled',(select relrowsecurity from pg_class where oid='public.profiles'::regclass)
 union all select 'Profiles SELECT remains own-profile',(select pg_get_expr(polqual,polrelid)='(id = auth.uid())' from pg_policy where polrelid='public.profiles'::regclass and polname='profiles_select')
)
select jsonb_build_object(
 'runtime_probes_passed',true,
 'catalog_passed',(select bool_and(coalesce(passed,false)) from checks),
 'catalog_count',(select count(*) from checks),
 'checks',(select jsonb_agg(jsonb_build_object('name',name,'passed',coalesce(passed,false)) order by name) from checks),
 'function_definition_hash',(select md5(replace(pg_get_functiondef(oid),E'\r\n',E'\n')) from f),
 'effective_acl',(select proacl::text from f),
 'existing_role_counts',(select jsonb_object_agg(role,n) from (select role,count(*) n from public.workspace_members where revoked_at is null group by role) x),
 'coverage_note','Runtime SQL uses existing Owners only; Admin/Teacher/Viewer/revocation verified locally and by identical deployed definition. No memberships changed.'
) as verification;
