create table public.error_types (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 code text not null, description text not null, unique(workspace_id,code)
);
create table public.assignments (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 teaching_assignment_id uuid not null, class_id uuid not null, title text not null, assigned_on date not null, due_on date not null, check(due_on>=assigned_on), unique(workspace_id,id,class_id), foreign key(workspace_id,teaching_assignment_id,class_id) references public.teaching_assignments(workspace_id,id,class_id)
);
create table public.assignment_topics (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 assignment_id uuid not null, topic_id uuid not null, unique(workspace_id,assignment_id,topic_id),
 foreign key(workspace_id,assignment_id) references public.assignments(workspace_id,id),
 foreign key(workspace_id,topic_id) references public.topics(workspace_id,id)
);
create table public.assignment_exercises (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 assignment_id uuid not null, position integer not null check(position>0), description text not null, unique(workspace_id,assignment_id,position), unique(workspace_id,id,assignment_id),
 foreign key(workspace_id,assignment_id) references public.assignments(workspace_id,id)
);
create table public.homework_checks (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 assignment_id uuid not null, enrollment_id uuid not null, class_id uuid not null, checked_on date not null, autonomy smallint check(autonomy between 1 and 5), understanding smallint check(understanding between 1 and 5), notes text, suggestions text, unique(workspace_id,assignment_id,enrollment_id), unique(workspace_id,id,assignment_id), foreign key(workspace_id,assignment_id,class_id) references public.assignments(workspace_id,id,class_id), foreign key(workspace_id,enrollment_id,class_id) references public.enrollments(workspace_id,id,class_id)
);
create table public.homework_exercise_results (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 homework_check_id uuid not null, assignment_id uuid not null, exercise_id uuid not null, outcome text not null check(outcome in ('correct','wrong','partial','not_done')), notes text, unique(workspace_id,homework_check_id,exercise_id), foreign key(workspace_id,homework_check_id,assignment_id) references public.homework_checks(workspace_id,id,assignment_id), foreign key(workspace_id,exercise_id,assignment_id) references public.assignment_exercises(workspace_id,id,assignment_id)
);
create table public.homework_errors (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 exercise_result_id uuid not null, error_type_id uuid not null, unique(workspace_id,exercise_result_id,error_type_id),
 foreign key(workspace_id,exercise_result_id) references public.homework_exercise_results(workspace_id,id),
 foreign key(workspace_id,error_type_id) references public.error_types(workspace_id,id)
);
