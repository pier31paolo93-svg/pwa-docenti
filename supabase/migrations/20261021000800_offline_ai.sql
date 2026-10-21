create table public.ai_workspace_settings (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 enabled boolean not null default false check(enabled=false), policy_version text not null default 'phase1-disabled', unique(workspace_id)
);
create table public.ai_requests (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 kind text not null check(kind in ('teaching_suggestion','exercise','recovery_plan','aggregate_errors')), status text not null default 'disabled' check(status='disabled'), contract_version integer not null default 1 check(contract_version=1)
);
create table public.import_batches (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 kind text not null check(kind in ('students','enrollments')), status text not null default 'preview' check(status in ('preview','applied','rejected')), unique(workspace_id,id,kind)
);
create table public.import_rows (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 batch_id uuid not null, row_number integer not null check(row_number>0), payload jsonb not null, validation_errors jsonb not null default '[]', duplicate_of uuid, resolution text not null default 'pending' check(resolution in ('pending','skip','insert','reject')), unique(workspace_id,batch_id,row_number),
 foreign key(workspace_id,batch_id) references public.import_batches(workspace_id,id),
 foreign key(workspace_id,duplicate_of) references public.students(workspace_id,id)
);
