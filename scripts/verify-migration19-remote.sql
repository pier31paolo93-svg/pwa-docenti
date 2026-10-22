-- Read-only verification: no fixtures, passwords, account changes or DML.
begin read only;
set local statement_timeout='15s';
with adapters as (
 select p.* from pg_proc p where p.oid in (
  'public.frontend_sync_mutation(uuid,text,uuid,uuid,bigint,jsonb)'::regprocedure,
  'public.frontend_apply_import(uuid,bigint)'::regprocedure)
), checks as (
 select 'PostgreSQL 17' as name,current_setting('server_version_num')::integer between 170000 and 179999 as passed
 union all select '19 migrations including migration 19',(select count(*)=19 and count(*) filter(where version='20261022000300')=1 from supabase_migrations.schema_migrations)
 union all select 'excused boolean not null default false',exists(select 1 from information_schema.columns where table_schema='public' and table_name='homework_checks' and column_name='excused' and data_type='boolean' and is_nullable='NO' and column_default='false')
 union all select 'excuse_reason nullable text',exists(select 1 from information_schema.columns where table_schema='public' and table_name='homework_checks' and column_name='excuse_reason' and data_type='text' and is_nullable='YES')
 union all select 'evaluation_rule_id nullable uuid',exists(select 1 from information_schema.columns where table_schema='public' and table_name='assessments' and column_name='evaluation_rule_id' and data_type='uuid' and is_nullable='YES')
 union all select 'justification CHECK validated',exists(select 1 from pg_constraint where conrelid='public.homework_checks'::regclass and conname='homework_excuse_reason' and contype='c' and convalidated)
 union all select 'rule FK validated and workspace scoped',exists(select 1 from pg_constraint c where c.conrelid='public.assessments'::regclass and c.conname='assessments_default_rule_fk' and c.contype='f' and c.convalidated and c.confrelid='public.evaluation_rules'::regclass and (select array_agg(a.attname::text order by k.n) from unnest(c.conkey) with ordinality k(att,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.att)=array['workspace_id','evaluation_rule_id'] and (select array_agg(a.attname::text order by k.n) from unnest(c.confkey) with ordinality k(att,n) join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.att)=array['workspace_id','id'])
 union all select 'new index valid ready btree',exists(select 1 from pg_index i where i.indexrelid='public.assessments_evaluation_rule_idx'::regclass and i.indisvalid and i.indisready and pg_get_indexdef(i.indexrelid) like '%USING btree (workspace_id, evaluation_rule_id)%')
 union all select 'one correct access link',(select count(*)=1 and bool_and(parent_table='evaluation_rules') from private.access_links where table_name='assessments' and column_name='evaluation_rule_id')
 union all select 'new view security invoker',exists(select 1 from pg_class where oid='public.v_homework_completion'::regclass and relkind='v' and 'security_invoker=true'=any(reloptions))
 union all select 'view depends on existing summary',pg_get_viewdef('public.v_homework_completion'::regclass,true) like '%v_homework_summary%'
 union all select 'view filters deleted records',pg_get_viewdef('public.v_homework_completion'::regclass,true) like '%deleted_at IS NULL%'
 union all select 'authenticated can select view',has_table_privilege('authenticated','public.v_homework_completion','SELECT')
 union all select 'anon cannot select view',not has_table_privilege('anon','public.v_homework_completion','SELECT')
 union all select 'PUBLIC has no view grants',not exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where c.oid='public.v_homework_completion'::regclass and a.grantee=0)
 union all select 'authenticated view grants SELECT only',not has_table_privilege('authenticated','public.v_homework_completion','INSERT,UPDATE,DELETE') and not exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where c.oid='public.v_homework_completion'::regclass and a.grantee=(select oid from pg_roles where rolname='authenticated') and a.privilege_type<>'SELECT')
 union all select 'two adapter functions',(select count(*)=2 from adapters)
 union all select 'adapters security invoker',(select bool_and(not prosecdef) from adapters)
 union all select 'adapters empty search path',(select bool_and('search_path=""'=any(proconfig)) from adapters)
 union all select 'authenticated can execute sync adapter',has_function_privilege('authenticated','public.frontend_sync_mutation(uuid,text,uuid,uuid,bigint,jsonb)','EXECUTE')
 union all select 'authenticated can execute import adapter',has_function_privilege('authenticated','public.frontend_apply_import(uuid,bigint)','EXECUTE')
 union all select 'anon cannot execute adapters',(select bool_and(not has_function_privilege('anon',oid,'EXECUTE')) from adapters)
 union all select 'PUBLIC has no adapter grants',not exists(select 1 from adapters p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0)
 union all select 'adapters map conflict to PT409',(select bool_and(prosrc like '%serialization_failure%' and prosrc like '%PT409%') from adapters)
 union all select 'sync adapter delegates existing RPC',(select prosrc like '%public.sync_mutation(%' from adapters where proname='frontend_sync_mutation')
 union all select 'import adapter delegates existing RPC',(select prosrc like '%public.apply_import(%' from adapters where proname='frontend_apply_import')
 union all select 'all public tables retain RLS',not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity)
 union all select 'all constraints validated',not exists(select 1 from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in ('public','private') and not c.convalidated)
 union all select 'all application indexes valid',not exists(select 1 from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and (not i.indisvalid or not i.indisready))
 union all select 'two Auth accounts',(select count(*)=2 from auth.users)
 union all select 'two profiles',(select count(*)=2 from public.profiles)
 union all select 'two separate workspaces',(select count(*)=2 and count(distinct owner_id)=2 from public.workspaces)
 union all select 'two correct Owner memberships',(select count(*)=2 from public.workspaces w join public.workspace_members m on m.workspace_id=w.id and m.user_id=w.owner_id where m.role='owner' and m.revoked_at is null and w.deleted_at is null)
 union all select 'no added memberships',(select count(*)=2 from public.workspace_members)
 union all select 'AI remains disabled',not exists(select 1 from public.ai_workspace_settings where enabled)
)
select jsonb_build_object('passed',(select bool_and(coalesce(passed,false)) from checks),'check_count',(select count(*) from checks),'checks',(select jsonb_agg(jsonb_build_object('name',name,'passed',coalesce(passed,false)) order by name) from checks),'adapter_definitions',(select jsonb_object_agg(proname,md5(pg_get_functiondef(oid))) from adapters)) as verification;
rollback;
