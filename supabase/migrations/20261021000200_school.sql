create table public.school_years (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 label text not null, starts_on date not null, ends_on date not null, check(ends_on>starts_on), unique(workspace_id,label)
);
create table public.schools (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 name text not null, code text not null, unique(workspace_id,code)
);
create table public.subjects (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 name text not null, code text not null, unique(workspace_id,code)
);
create table public.classes (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 school_id uuid not null, school_year_id uuid not null, name text not null, unique(workspace_id,school_id,school_year_id,name),
 foreign key(workspace_id,school_id) references public.schools(workspace_id,id),
 foreign key(workspace_id,school_year_id) references public.school_years(workspace_id,id)
);
create table public.students (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 external_code text not null, first_name text not null, last_name text not null, archived_at timestamptz, unique(workspace_id,external_code)
);
create table public.enrollments (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 student_id uuid not null, class_id uuid not null, starts_on date not null, ends_on date, outcome text check(outcome in ('promoted','repeating','transferred','withdrawn')), check(ends_on is null or ends_on>=starts_on), unique(workspace_id,class_id,student_id), unique(workspace_id,id,class_id),
 foreign key(workspace_id,student_id) references public.students(workspace_id,id),
 foreign key(workspace_id,class_id) references public.classes(workspace_id,id)
);
create table public.class_subjects (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 class_id uuid not null, subject_id uuid not null, unique(workspace_id,class_id,subject_id), unique(workspace_id,id,class_id),
 foreign key(workspace_id,class_id) references public.classes(workspace_id,id),
 foreign key(workspace_id,subject_id) references public.subjects(workspace_id,id)
);
create table public.teaching_assignments (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 class_subject_id uuid not null, class_id uuid not null, teacher_id uuid not null, unique(workspace_id,class_subject_id,teacher_id), unique(workspace_id,id,class_id), foreign key(workspace_id,class_subject_id,class_id) references public.class_subjects(workspace_id,id,class_id), foreign key(workspace_id,teacher_id) references public.workspace_members(workspace_id,user_id),
 foreign key(workspace_id,class_id) references public.classes(workspace_id,id)
);
