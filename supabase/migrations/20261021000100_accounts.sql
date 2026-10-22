create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create table public.profiles (
 id uuid primary key references auth.users(id), display_name text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0)
);
create table public.workspaces (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name)>0),
 owner_id uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version>0), deleted_at timestamptz
);
create table public.workspace_members (
 workspace_id uuid not null references public.workspaces(id),
 user_id uuid not null references public.profiles(id),
 role text not null check(role in ('owner','admin','teacher','viewer')),
 created_at timestamptz not null default now(),
 primary key(workspace_id,user_id)
);
create unique index one_owner_per_workspace on public.workspace_members(workspace_id) where role='owner';
create function private.member_role(w uuid) returns text language sql stable security definer set search_path='' as $$
 select m.role from public.workspace_members m join public.workspaces w on w.id=m.workspace_id
 where m.workspace_id=$1 and m.user_id=auth.uid() and w.deleted_at is null
$$;
create function private.can_read(w uuid, author uuid, scope text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.member_role(w) is not null and (scope='workspace' or author=auth.uid())
$$;
create function private.can_write(w uuid, author uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(private.member_role(w) in ('owner','admin') or
 (private.member_role(w)='teacher' and author=auth.uid()),false)
$$;
create function private.bootstrap_user() returns trigger language plpgsql security definer set search_path='' as $$
 declare w uuid;
 begin
 insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name',''));
 insert into public.workspaces(name,owner_id) values('Workspace personale',new.id) returning id into w;
 insert into public.workspace_members values(w,new.id,'owner',now());
 return new;
 end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.bootstrap_user();
revoke all on all functions in schema private from public;
grant execute on function private.member_role(uuid),private.can_read(uuid,uuid,text),private.can_write(uuid,uuid) to authenticated;
