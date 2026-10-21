create table public.evaluation_categories (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 code text not null, name text not null, contributes_to_average boolean not null default true, unique(workspace_id,code)
);
create table public.evaluation_rules (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 name text not null, minimum numeric not null, maximum numeric not null, rounding_step numeric not null default 0.01 check(rounding_step>0), conversion_points jsonb not null default '[[0,0],[1,1]]' check(jsonb_typeof(conversion_points)='array'), check(maximum>minimum)
);
create table public.grade_entries (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 enrollment_id uuid not null, teaching_assignment_id uuid not null, class_id uuid not null, category_id uuid not null, rule_id uuid not null, graded_on date not null, suggested_value numeric, confirmed_value numeric, weight numeric not null default 1 check(weight>0), origin text not null check(origin in ('assessment','observation','homework','manual')), assessment_result_id uuid, observation_id uuid, homework_check_id uuid, status text not null default 'draft' check(status in ('draft','confirmed','cancelled')), excluded_from_average boolean not null default false, allow_behavior_in_average boolean not null default false, change_reason text, calculation_snapshot jsonb not null default '{}', check(status<>'confirmed' or confirmed_value is not null), check((origin='assessment' and assessment_result_id is not null and observation_id is null and homework_check_id is null) or (origin='observation' and observation_id is not null and assessment_result_id is null and homework_check_id is null) or (origin='homework' and homework_check_id is not null and assessment_result_id is null and observation_id is null) or (origin='manual' and assessment_result_id is null and observation_id is null and homework_check_id is null)), foreign key(workspace_id,enrollment_id,class_id) references public.enrollments(workspace_id,id,class_id), foreign key(workspace_id,teaching_assignment_id,class_id) references public.teaching_assignments(workspace_id,id,class_id), foreign key(workspace_id,assessment_result_id,enrollment_id,teaching_assignment_id) references public.assessment_results(workspace_id,id,enrollment_id,teaching_assignment_id), foreign key(workspace_id,observation_id,enrollment_id,teaching_assignment_id) references public.observations(workspace_id,id,enrollment_id,teaching_assignment_id),
 foreign key(workspace_id,category_id) references public.evaluation_categories(workspace_id,id),
 foreign key(workspace_id,rule_id) references public.evaluation_rules(workspace_id,id),
 foreign key(workspace_id,homework_check_id) references public.homework_checks(workspace_id,id)
);
