create table public.topics (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 subject_id uuid not null, name text not null, unique(workspace_id,subject_id,name),
 foreign key(workspace_id,subject_id) references public.subjects(workspace_id,id)
);
create table public.competencies (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 subject_id uuid not null, code text not null, description text not null, unique(workspace_id,subject_id,code),
 foreign key(workspace_id,subject_id) references public.subjects(workspace_id,id)
);
create table public.lessons (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 teaching_assignment_id uuid not null, starts_at timestamptz not null, ends_at timestamptz not null, title text not null, notes text, status text not null default 'draft' check(status in ('draft','confirmed')), check(ends_at>starts_at),
 foreign key(workspace_id,teaching_assignment_id) references public.teaching_assignments(workspace_id,id)
);
create table public.lesson_topics (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 lesson_id uuid not null, topic_id uuid not null, unique(workspace_id,lesson_id,topic_id),
 foreign key(workspace_id,lesson_id) references public.lessons(workspace_id,id),
 foreign key(workspace_id,topic_id) references public.topics(workspace_id,id)
);
create table public.lesson_activities (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 lesson_id uuid not null, description text not null, position integer not null default 0 check(position>=0),
 foreign key(workspace_id,lesson_id) references public.lessons(workspace_id,id)
);
