-- Structural fingerprint only; never reads application records.
with objects(kind,name,definition) as (
 select 'table',n.nspname||'.'||c.relname,c.relrowsecurity::text
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r'
 union all
 select 'column',n.nspname||'.'||c.relname||'.'||a.attname,
 concat_ws('|',a.attnum,format_type(a.atttypid,a.atttypmod),a.attnotnull,coalesce(pg_get_expr(d.adbin,d.adrelid),''))
 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
 where n.nspname in ('public','private') and c.relkind='r' and a.attnum>0 and not a.attisdropped
 union all
 select 'index',n.nspname||'.'||ci.relname,pg_get_indexdef(i.indexrelid)
 from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class ci on ci.oid=i.indexrelid where n.nspname in ('public','private')
 union all
 select 'constraint',n.nspname||'.'||c.relname||'.'||k.conname,pg_get_constraintdef(k.oid)
 from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private')
 union all
 select 'view',n.nspname||'.'||c.relname,pg_get_viewdef(c.oid)||coalesce(c.reloptions::text,'')
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v'
 union all
 select 'function',n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',replace(pg_get_functiondef(p.oid),E'\r\n',E'\n')
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f' and not(n.nspname='public' and p.proname='rls_auto_enable')
 union all
 select 'trigger',n.nspname||'.'||c.relname||'.'||t.tgname,pg_get_triggerdef(t.oid)
 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and (n.nspname in ('public','private') or (n.nspname='auth' and c.relname='users' and t.tgname='on_auth_user_created'))
 union all
 select 'policy',n.nspname||'.'||c.relname||'.'||p.polname,
 concat_ws('|',p.polcmd,p.polpermissive,(select string_agg(r.rolname,',' order by r.rolname) from pg_roles r where r.oid=any(p.polroles)),coalesce(pg_get_expr(p.polqual,p.polrelid),''),coalesce(pg_get_expr(p.polwithcheck,p.polrelid),''))
 from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private')
)
select jsonb_agg(jsonb_build_object('kind',kind,'name',name,'hash',md5(definition)) order by kind,name) as fingerprint from objects;
