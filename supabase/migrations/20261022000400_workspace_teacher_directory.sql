-- Migration 20. Prepare/test locally; cloud application requires authorization.
-- Narrow read-only directory: no auth.users, email access or table/RLS changes.
create function public.workspace_teacher_directory(p_workspace uuid)
returns table(user_id uuid,display_name text,member_role text)
language plpgsql stable security definer set search_path='' as $$
begin
 if private.member_role(p_workspace) is null
 or private.member_role(p_workspace) not in ('owner','admin') then
  raise exception 'Workspace administrator required' using errcode='42501';
 end if;
 return query
 select m.user_id,p.display_name,m.role
 from public.workspace_members m join public.profiles p on p.id=m.user_id
 where m.workspace_id=p_workspace and m.revoked_at is null
 and m.role in ('owner','admin','teacher')
 order by p.display_name,m.user_id;
end $$;
revoke all on function public.workspace_teacher_directory(uuid) from public,anon,authenticated;
grant execute on function public.workspace_teacher_directory(uuid) to authenticated;
