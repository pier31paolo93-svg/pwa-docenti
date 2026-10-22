-- One metadata-only SELECT: no student rows, credentials, DDL or DML.
with relations as (
 select n.nspname as schema_name,c.relname as object_name,c.relkind,
 pg_get_userbyid(c.relowner) as owner,c.relrowsecurity,c.reloptions
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','private') and c.relkind in ('r','p','v','m','S')
), routines as (
 select n.nspname as schema_name,p.proname,pg_get_function_identity_arguments(p.oid) as identity_arguments,
 p.prosecdef,p.proacl,p.proconfig,md5(pg_get_functiondef(p.oid)) as definition_hash
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private') and p.prokind='f'
), policies as (
 select n.nspname as schema_name,c.relname,p.polname,p.polcmd,p.polpermissive,p.polroles
 from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','private')
), triggers as (
 select n.nspname as schema_name,c.relname,t.tgname,p.proname as handler
 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
 join pg_proc p on p.oid=t.tgfoid
 where not t.tgisinternal and (n.nspname in ('public','private') or (n.nspname='auth' and c.relname='users'))
), grants as (
 select table_schema,table_name,grantee,privilege_type
 from information_schema.table_privileges where table_schema in ('public','private')
)
select jsonb_build_object(
 'server_version',current_setting('server_version'),
 'database_name',current_database(),
 'has_migration_history',to_regclass('supabase_migrations.schema_migrations') is not null,
 'existing_auth_user_count',(select count(*) from auth.users),
 'relations',coalesce((select jsonb_agg(to_jsonb(x) order by schema_name,object_name) from relations x),'[]'),
 'routines',coalesce((select jsonb_agg(to_jsonb(x) order by schema_name,proname,identity_arguments) from routines x),'[]'),
 'policies',coalesce((select jsonb_agg(to_jsonb(x) order by schema_name,relname,polname) from policies x),'[]'),
 'triggers',coalesce((select jsonb_agg(to_jsonb(x) order by schema_name,relname,tgname) from triggers x),'[]'),
 'grants',coalesce((select jsonb_agg(to_jsonb(x) order by table_schema,table_name,grantee,privilege_type) from grants x),'[]')
) as preflight;
