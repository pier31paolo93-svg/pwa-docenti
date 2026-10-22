begin read only;
select current_setting('server_version') as postgres_version;
select count(*) as public_tables,count(*) filter(where c.relrowsecurity) as tables_with_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r';
select c.relname,count(p.oid) as policy_count from pg_class c join pg_namespace n on n.oid=c.relnamespace left join pg_policy p on p.polrelid=c.oid where n.nspname='public' and c.relkind='r' group by c.relname having count(p.oid)<>4;
select n.nspname,c.relname,privilege from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) privilege where n.nspname in ('public','private') and c.relkind in ('r','v') and has_table_privilege('anon',c.oid,privilege);
select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and has_table_privilege('authenticated',c.oid,'DELETE');
select n.nspname,p.proname,p.prosecdef,
 exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') order by 1,2;
select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v' and not coalesce(c.reloptions @> array['security_invoker=true'],false);
select count(*) as remote_ready_local_migrations from supabase_migrations.schema_migrations;
do $$ begin
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity) then raise exception 'Public table without RLS'; end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace left join pg_policy p on p.polrelid=c.oid where n.nspname='public' and c.relkind='r' group by c.oid having count(*)<>4 or count(distinct p.polcmd)<>4) then raise exception 'Incomplete policy matrix'; end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) privilege where n.nspname in ('public','private') and c.relkind in ('r','v') and has_table_privilege('anon',c.oid,privilege)) then raise exception 'Anonymous table privilege'; end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where n.nspname in ('public','private') and a.grantee=0 and a.privilege_type='EXECUTE') then raise exception 'PUBLIC execute privilege'; end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosecdef and not coalesce(p.proconfig @> array['search_path=""'],false)) then raise exception 'Unsafe SECURITY DEFINER search_path'; end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v' and not coalesce(c.reloptions @> array['security_invoker=true'],false)) then raise exception 'View without security_invoker'; end if;
end $$;
select 'PASS local catalog security preflight' as result;
rollback;
