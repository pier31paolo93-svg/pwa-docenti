create table public.observation_types (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 code text not null, description text not null, disciplinary_default boolean not null default false, unique(workspace_id,code)
);
create table public.observations (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 teaching_assignment_id uuid not null, class_id uuid not null, enrollment_id uuid not null, observation_type_id uuid not null, observed_on date not null, mode text not null check(mode in ('DESCRIPTIVE','GRADED')), notes text, participation text, observable_behaviors text, difficulties text, strengths text, unique(workspace_id,id,enrollment_id,teaching_assignment_id), foreign key(workspace_id,teaching_assignment_id,class_id) references public.teaching_assignments(workspace_id,id,class_id), foreign key(workspace_id,enrollment_id,class_id) references public.enrollments(workspace_id,id,class_id),
 foreign key(workspace_id,observation_type_id) references public.observation_types(workspace_id,id)
);
create table public.observation_errors (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 observation_id uuid not null, error_type_id uuid not null, unique(workspace_id,observation_id,error_type_id),
 foreign key(workspace_id,observation_id) references public.observations(workspace_id,id),
 foreign key(workspace_id,error_type_id) references public.error_types(workspace_id,id)
);
create table public.observation_competencies (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 observation_id uuid not null, competency_id uuid not null, unique(workspace_id,observation_id,competency_id),
 foreign key(workspace_id,observation_id) references public.observations(workspace_id,id),
 foreign key(workspace_id,competency_id) references public.competencies(workspace_id,id)
);
create table public.observation_topics (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 observation_id uuid not null, topic_id uuid not null, unique(workspace_id,observation_id,topic_id),
 foreign key(workspace_id,observation_id) references public.observations(workspace_id,id),
 foreign key(workspace_id,topic_id) references public.topics(workspace_id,id)
);
