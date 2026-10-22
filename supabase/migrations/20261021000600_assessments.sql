create table public.assessment_rubrics (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 name text not null, description text
);
create table public.rubric_criteria (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 rubric_id uuid not null, label text not null, weight numeric not null check(weight>0), max_score numeric not null check(max_score>0), levels jsonb not null check(jsonb_typeof(levels)='array'),
 foreign key(workspace_id,rubric_id) references public.assessment_rubrics(workspace_id,id)
);
create table public.assessments (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 teaching_assignment_id uuid not null, class_id uuid not null, title text not null, assessed_on date not null, kind text not null check(kind in ('written','oral','practical','graded_exercise')), correction_mode text not null check(correction_mode in ('quick','analytic','rubric')), rubric_id uuid, unique(workspace_id,id,class_id), unique(workspace_id,id,teaching_assignment_id), foreign key(workspace_id,teaching_assignment_id,class_id) references public.teaching_assignments(workspace_id,id,class_id),
 foreign key(workspace_id,rubric_id) references public.assessment_rubrics(workspace_id,id)
);
create table public.assessment_questions (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 assessment_id uuid not null, parent_question_id uuid, label text not null, max_score numeric not null check(max_score>0), competency_id uuid, topic_id uuid, unique(workspace_id,id,assessment_id), foreign key(workspace_id,parent_question_id,assessment_id) references public.assessment_questions(workspace_id,id,assessment_id), check(parent_question_id is null or parent_question_id<>id),
 foreign key(workspace_id,assessment_id) references public.assessments(workspace_id,id),
 foreign key(workspace_id,competency_id) references public.competencies(workspace_id,id),
 foreign key(workspace_id,topic_id) references public.topics(workspace_id,id)
);
create table public.assessment_results (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 assessment_id uuid not null, teaching_assignment_id uuid not null, class_id uuid not null, enrollment_id uuid not null, notes text, unique(workspace_id,assessment_id,enrollment_id), unique(workspace_id,id,enrollment_id,teaching_assignment_id), unique(workspace_id,id,assessment_id), foreign key(workspace_id,assessment_id,class_id) references public.assessments(workspace_id,id,class_id), foreign key(workspace_id,assessment_id,teaching_assignment_id) references public.assessments(workspace_id,id,teaching_assignment_id), foreign key(workspace_id,enrollment_id,class_id) references public.enrollments(workspace_id,id,class_id)
);
create table public.question_results (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 assessment_result_id uuid not null, assessment_id uuid not null, question_id uuid not null, score numeric check(score>=0), quick_result text check(quick_result in ('good','partial','poor','unanswered')), notes text, max_score_snapshot numeric not null check(max_score_snapshot>0), check(score<=max_score_snapshot), unique(workspace_id,assessment_result_id,question_id), foreign key(workspace_id,assessment_result_id,assessment_id) references public.assessment_results(workspace_id,id,assessment_id), foreign key(workspace_id,question_id,assessment_id) references public.assessment_questions(workspace_id,id,assessment_id)
);
create table public.question_errors (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 question_result_id uuid not null, error_type_id uuid not null, unique(workspace_id,question_result_id,error_type_id),
 foreign key(workspace_id,question_result_id) references public.question_results(workspace_id,id),
 foreign key(workspace_id,error_type_id) references public.error_types(workspace_id,id)
);
create table public.rubric_scores (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 visibility text not null default 'workspace' check (visibility in ('workspace','private')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version > 0),
 deleted_at timestamptz,
 unique(workspace_id,id),
 assessment_result_id uuid not null, criterion_id uuid not null, criterion_label_snapshot text not null, levels_snapshot jsonb not null, max_score_snapshot numeric not null check(max_score_snapshot>0), weight_snapshot numeric not null check(weight_snapshot>0), score numeric not null check(score>=0 and score<=max_score_snapshot), unique(workspace_id,assessment_result_id,criterion_id),
 foreign key(workspace_id,assessment_result_id) references public.assessment_results(workspace_id,id),
 foreign key(workspace_id,criterion_id) references public.rubric_criteria(workspace_id,id)
);
