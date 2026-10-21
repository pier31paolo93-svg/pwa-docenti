create function private.assignment_access(t text,r jsonb,depth integer default 0) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare l record; parent jsonb;
begin
 if depth>20 then return false; end if;
 if t='teaching_assignments' then return (r->>'teacher_id')::uuid=auth.uid(); end if;
 for l in select * from private.access_links where table_name=t loop
  if r->>l.column_name is not null then
   execute format('select to_jsonb(p) from public.%I p where p.id=$1 and p.workspace_id=$2',l.parent_table) into parent using (r->>l.column_name)::uuid,(r->>'workspace_id')::uuid;
   if parent is not null and not private.assignment_access(l.parent_table,parent,depth+1) then return false; end if;
  end if;
 end loop;
 return true;
end $$;
revoke all on function private.assignment_access(text,jsonb,integer) from public,anon;
grant execute on function private.assignment_access(text,jsonb,integer) to authenticated;
