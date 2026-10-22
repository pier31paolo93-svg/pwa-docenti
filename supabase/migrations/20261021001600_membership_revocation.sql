-- Retain historical teacher references while revoking every active permission.
alter table public.workspace_members add column revoked_at timestamptz;
create or replace function private.member_role(w uuid) returns text language sql stable security definer set search_path='' as $$
 select m.role from public.workspace_members m join public.workspaces w on w.id=m.workspace_id
 where m.workspace_id=$1 and m.user_id=auth.uid() and m.revoked_at is null and w.deleted_at is null
$$;
create or replace function public.set_workspace_member(p_workspace uuid,p_user uuid,p_role text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.workspaces where id=p_workspace for update;
 if private.member_role(p_workspace) is distinct from 'owner' then raise exception 'Owner required' using errcode='42501'; end if;
 if p_role not in ('admin','teacher','viewer') or p_role is null or p_user=auth.uid() then raise exception 'Invalid role change' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles where id=p_user) then raise exception 'Existing invited user required'; end if;
 insert into public.workspace_members(workspace_id,user_id,role) values(p_workspace,p_user,p_role)
 on conflict(workspace_id,user_id) do update set role=excluded.role,revoked_at=null;
end $$;
create or replace function public.remove_workspace_member(p_workspace uuid,p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.workspaces where id=p_workspace for update;
 if private.member_role(p_workspace) is distinct from 'owner' or p_user=auth.uid() then raise exception 'Owner required; cannot remove owner' using errcode='42501'; end if;
 update public.workspace_members set revoked_at=clock_timestamp() where workspace_id=p_workspace and user_id=p_user;
end $$;
