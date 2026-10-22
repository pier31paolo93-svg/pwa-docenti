create table private.access_links(table_name text, column_name text, parent_table text, primary key(table_name,column_name));
insert into private.access_links values ('classes','school_id','schools'),
('classes','school_year_id','school_years'),
('enrollments','student_id','students'),
('enrollments','class_id','classes'),
('class_subjects','class_id','classes'),
('class_subjects','subject_id','subjects'),
('teaching_assignments','class_id','classes'),
('teaching_assignments','class_subject_id','class_subjects'),
('topics','subject_id','subjects'),
('competencies','subject_id','subjects'),
('lessons','teaching_assignment_id','teaching_assignments'),
('lesson_topics','lesson_id','lessons'),
('lesson_topics','topic_id','topics'),
('lesson_activities','lesson_id','lessons'),
('assignments','teaching_assignment_id','teaching_assignments'),
('assignment_topics','assignment_id','assignments'),
('assignment_topics','topic_id','topics'),
('assignment_exercises','assignment_id','assignments'),
('homework_checks','assignment_id','assignments'),
('homework_checks','enrollment_id','enrollments'),
('homework_exercise_results','homework_check_id','homework_checks'),
('homework_exercise_results','exercise_id','assignment_exercises'),
('homework_errors','exercise_result_id','homework_exercise_results'),
('homework_errors','error_type_id','error_types'),
('observations','observation_type_id','observation_types'),
('observations','teaching_assignment_id','teaching_assignments'),
('observations','enrollment_id','enrollments'),
('observation_errors','observation_id','observations'),
('observation_errors','error_type_id','error_types'),
('observation_competencies','observation_id','observations'),
('observation_competencies','competency_id','competencies'),
('observation_topics','observation_id','observations'),
('observation_topics','topic_id','topics'),
('rubric_criteria','rubric_id','assessment_rubrics'),
('assessments','rubric_id','assessment_rubrics'),
('assessments','teaching_assignment_id','teaching_assignments'),
('assessment_questions','assessment_id','assessments'),
('assessment_questions','competency_id','competencies'),
('assessment_questions','topic_id','topics'),
('assessment_results','assessment_id','assessments'),
('assessment_results','enrollment_id','enrollments'),
('question_results','assessment_result_id','assessment_results'),
('question_results','question_id','assessment_questions'),
('question_errors','question_result_id','question_results'),
('question_errors','error_type_id','error_types'),
('rubric_scores','assessment_result_id','assessment_results'),
('rubric_scores','criterion_id','rubric_criteria'),
('grade_entries','category_id','evaluation_categories'),
('grade_entries','rule_id','evaluation_rules'),
('grade_entries','homework_check_id','homework_checks'),
('grade_entries','enrollment_id','enrollments'),
('grade_entries','teaching_assignment_id','teaching_assignments'),
('grade_entries','assessment_result_id','assessment_results'),
('grade_entries','observation_id','observations'),
('import_rows','batch_id','import_batches'),
('import_rows','duplicate_of','students');
create function private.allowed(t text, r jsonb, writing boolean, depth integer default 0) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare l record; parent jsonb; member text;
begin
 if depth>20 or not private.can_read((r->>'workspace_id')::uuid,(r->>'created_by')::uuid,r->>'visibility') then return false; end if;
 member:=private.member_role((r->>'workspace_id')::uuid);
 if writing and not private.can_write((r->>'workspace_id')::uuid,(r->>'created_by')::uuid) then return false; end if;
 if t='teaching_assignments' and member='teacher' and (r->>'teacher_id')::uuid<>auth.uid() then return false; end if;
 if t='teaching_assignments' and writing and member not in ('owner','admin') then return false; end if;
 if t in ('ai_workspace_settings','evaluation_rules','evaluation_categories') and writing and member not in ('owner','admin') then return false; end if;
 for l in select * from private.access_links where table_name=t loop
   if r->>l.column_name is not null then
    execute format('select to_jsonb(p) from public.%I p where p.id=$1 and p.workspace_id=$2',l.parent_table)
     into parent using (r->>l.column_name)::uuid,(r->>'workspace_id')::uuid;
    if parent is null or parent->>'deleted_at' is not null or not private.allowed(l.parent_table,parent,false,depth+1) then return false; end if;
   end if;
 end loop;
 -- All teaching records are restricted to the assigned teacher, owner/admin or viewer.
 if writing and member='teacher' then
   if not private.assignment_access(t,r) then return false; end if;
   if t='lessons' or r ? 'teaching_assignment_id' then
     if not exists(select 1 from public.teaching_assignments a where a.id=(r->>'teaching_assignment_id')::uuid
        and a.workspace_id=(r->>'workspace_id')::uuid and a.teacher_id=auth.uid() and a.deleted_at is null) then return false; end if;
   end if;
 end if;
 return true;
end $$;
revoke all on function private.allowed(text,jsonb,boolean,integer) from public;
grant execute on function private.allowed(text,jsonb,boolean,integer) to authenticated;

create function private.stamp_record() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' then
  if auth.uid() is not null and new.created_by<>auth.uid() then raise exception 'Author spoofing' using errcode='42501'; end if;
  new.version:=1; new.created_at:=now(); new.updated_at:=now();
 else
  if new.id<>old.id or new.workspace_id<>old.workspace_id or new.created_by<>old.created_by or new.created_at<>old.created_at or new.visibility<>old.visibility then
    raise exception 'Immutable ownership, scope or visibility' using errcode='42501';
  end if;
  if new.version<>old.version+1 then raise exception 'Version conflict: expected %',old.version using errcode='40001'; end if;
  new.updated_at:=clock_timestamp();
 end if;
 return new;
end $$;

alter table public.school_years enable row level security;
revoke all on public.school_years from anon, authenticated;
grant select, insert, update on public.school_years to authenticated;
create policy school_years_select on public.school_years for select to authenticated using(private.allowed('school_years',to_jsonb(school_years),false));
create policy school_years_insert on public.school_years for insert to authenticated with check(created_by=auth.uid() and private.allowed('school_years',to_jsonb(school_years),true));
create policy school_years_update on public.school_years for update to authenticated using(private.allowed('school_years',to_jsonb(school_years),true)) with check(private.allowed('school_years',to_jsonb(school_years),true));
create policy school_years_delete on public.school_years for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.school_years for each row execute function private.stamp_record();
create index school_years_workspace_updated on public.school_years(workspace_id,updated_at,id);

alter table public.schools enable row level security;
revoke all on public.schools from anon, authenticated;
grant select, insert, update on public.schools to authenticated;
create policy schools_select on public.schools for select to authenticated using(private.allowed('schools',to_jsonb(schools),false));
create policy schools_insert on public.schools for insert to authenticated with check(created_by=auth.uid() and private.allowed('schools',to_jsonb(schools),true));
create policy schools_update on public.schools for update to authenticated using(private.allowed('schools',to_jsonb(schools),true)) with check(private.allowed('schools',to_jsonb(schools),true));
create policy schools_delete on public.schools for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.schools for each row execute function private.stamp_record();
create index schools_workspace_updated on public.schools(workspace_id,updated_at,id);

alter table public.subjects enable row level security;
revoke all on public.subjects from anon, authenticated;
grant select, insert, update on public.subjects to authenticated;
create policy subjects_select on public.subjects for select to authenticated using(private.allowed('subjects',to_jsonb(subjects),false));
create policy subjects_insert on public.subjects for insert to authenticated with check(created_by=auth.uid() and private.allowed('subjects',to_jsonb(subjects),true));
create policy subjects_update on public.subjects for update to authenticated using(private.allowed('subjects',to_jsonb(subjects),true)) with check(private.allowed('subjects',to_jsonb(subjects),true));
create policy subjects_delete on public.subjects for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.subjects for each row execute function private.stamp_record();
create index subjects_workspace_updated on public.subjects(workspace_id,updated_at,id);

alter table public.classes enable row level security;
revoke all on public.classes from anon, authenticated;
grant select, insert, update on public.classes to authenticated;
create policy classes_select on public.classes for select to authenticated using(private.allowed('classes',to_jsonb(classes),false));
create policy classes_insert on public.classes for insert to authenticated with check(created_by=auth.uid() and private.allowed('classes',to_jsonb(classes),true));
create policy classes_update on public.classes for update to authenticated using(private.allowed('classes',to_jsonb(classes),true)) with check(private.allowed('classes',to_jsonb(classes),true));
create policy classes_delete on public.classes for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.classes for each row execute function private.stamp_record();
create index classes_workspace_updated on public.classes(workspace_id,updated_at,id);

alter table public.students enable row level security;
revoke all on public.students from anon, authenticated;
grant select, insert, update on public.students to authenticated;
create policy students_select on public.students for select to authenticated using(private.allowed('students',to_jsonb(students),false));
create policy students_insert on public.students for insert to authenticated with check(created_by=auth.uid() and private.allowed('students',to_jsonb(students),true));
create policy students_update on public.students for update to authenticated using(private.allowed('students',to_jsonb(students),true)) with check(private.allowed('students',to_jsonb(students),true));
create policy students_delete on public.students for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.students for each row execute function private.stamp_record();
create index students_workspace_updated on public.students(workspace_id,updated_at,id);

alter table public.enrollments enable row level security;
revoke all on public.enrollments from anon, authenticated;
grant select, insert, update on public.enrollments to authenticated;
create policy enrollments_select on public.enrollments for select to authenticated using(private.allowed('enrollments',to_jsonb(enrollments),false));
create policy enrollments_insert on public.enrollments for insert to authenticated with check(created_by=auth.uid() and private.allowed('enrollments',to_jsonb(enrollments),true));
create policy enrollments_update on public.enrollments for update to authenticated using(private.allowed('enrollments',to_jsonb(enrollments),true)) with check(private.allowed('enrollments',to_jsonb(enrollments),true));
create policy enrollments_delete on public.enrollments for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.enrollments for each row execute function private.stamp_record();
create index enrollments_workspace_updated on public.enrollments(workspace_id,updated_at,id);

alter table public.class_subjects enable row level security;
revoke all on public.class_subjects from anon, authenticated;
grant select, insert, update on public.class_subjects to authenticated;
create policy class_subjects_select on public.class_subjects for select to authenticated using(private.allowed('class_subjects',to_jsonb(class_subjects),false));
create policy class_subjects_insert on public.class_subjects for insert to authenticated with check(created_by=auth.uid() and private.allowed('class_subjects',to_jsonb(class_subjects),true));
create policy class_subjects_update on public.class_subjects for update to authenticated using(private.allowed('class_subjects',to_jsonb(class_subjects),true)) with check(private.allowed('class_subjects',to_jsonb(class_subjects),true));
create policy class_subjects_delete on public.class_subjects for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.class_subjects for each row execute function private.stamp_record();
create index class_subjects_workspace_updated on public.class_subjects(workspace_id,updated_at,id);

alter table public.teaching_assignments enable row level security;
revoke all on public.teaching_assignments from anon, authenticated;
grant select, insert, update on public.teaching_assignments to authenticated;
create policy teaching_assignments_select on public.teaching_assignments for select to authenticated using(private.allowed('teaching_assignments',to_jsonb(teaching_assignments),false));
create policy teaching_assignments_insert on public.teaching_assignments for insert to authenticated with check(created_by=auth.uid() and private.allowed('teaching_assignments',to_jsonb(teaching_assignments),true));
create policy teaching_assignments_update on public.teaching_assignments for update to authenticated using(private.allowed('teaching_assignments',to_jsonb(teaching_assignments),true)) with check(private.allowed('teaching_assignments',to_jsonb(teaching_assignments),true));
create policy teaching_assignments_delete on public.teaching_assignments for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.teaching_assignments for each row execute function private.stamp_record();
create index teaching_assignments_workspace_updated on public.teaching_assignments(workspace_id,updated_at,id);

alter table public.topics enable row level security;
revoke all on public.topics from anon, authenticated;
grant select, insert, update on public.topics to authenticated;
create policy topics_select on public.topics for select to authenticated using(private.allowed('topics',to_jsonb(topics),false));
create policy topics_insert on public.topics for insert to authenticated with check(created_by=auth.uid() and private.allowed('topics',to_jsonb(topics),true));
create policy topics_update on public.topics for update to authenticated using(private.allowed('topics',to_jsonb(topics),true)) with check(private.allowed('topics',to_jsonb(topics),true));
create policy topics_delete on public.topics for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.topics for each row execute function private.stamp_record();
create index topics_workspace_updated on public.topics(workspace_id,updated_at,id);

alter table public.competencies enable row level security;
revoke all on public.competencies from anon, authenticated;
grant select, insert, update on public.competencies to authenticated;
create policy competencies_select on public.competencies for select to authenticated using(private.allowed('competencies',to_jsonb(competencies),false));
create policy competencies_insert on public.competencies for insert to authenticated with check(created_by=auth.uid() and private.allowed('competencies',to_jsonb(competencies),true));
create policy competencies_update on public.competencies for update to authenticated using(private.allowed('competencies',to_jsonb(competencies),true)) with check(private.allowed('competencies',to_jsonb(competencies),true));
create policy competencies_delete on public.competencies for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.competencies for each row execute function private.stamp_record();
create index competencies_workspace_updated on public.competencies(workspace_id,updated_at,id);

alter table public.lessons enable row level security;
revoke all on public.lessons from anon, authenticated;
grant select, insert, update on public.lessons to authenticated;
create policy lessons_select on public.lessons for select to authenticated using(private.allowed('lessons',to_jsonb(lessons),false));
create policy lessons_insert on public.lessons for insert to authenticated with check(created_by=auth.uid() and private.allowed('lessons',to_jsonb(lessons),true));
create policy lessons_update on public.lessons for update to authenticated using(private.allowed('lessons',to_jsonb(lessons),true)) with check(private.allowed('lessons',to_jsonb(lessons),true));
create policy lessons_delete on public.lessons for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.lessons for each row execute function private.stamp_record();
create index lessons_workspace_updated on public.lessons(workspace_id,updated_at,id);

alter table public.lesson_topics enable row level security;
revoke all on public.lesson_topics from anon, authenticated;
grant select, insert, update on public.lesson_topics to authenticated;
create policy lesson_topics_select on public.lesson_topics for select to authenticated using(private.allowed('lesson_topics',to_jsonb(lesson_topics),false));
create policy lesson_topics_insert on public.lesson_topics for insert to authenticated with check(created_by=auth.uid() and private.allowed('lesson_topics',to_jsonb(lesson_topics),true));
create policy lesson_topics_update on public.lesson_topics for update to authenticated using(private.allowed('lesson_topics',to_jsonb(lesson_topics),true)) with check(private.allowed('lesson_topics',to_jsonb(lesson_topics),true));
create policy lesson_topics_delete on public.lesson_topics for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.lesson_topics for each row execute function private.stamp_record();
create index lesson_topics_workspace_updated on public.lesson_topics(workspace_id,updated_at,id);

alter table public.lesson_activities enable row level security;
revoke all on public.lesson_activities from anon, authenticated;
grant select, insert, update on public.lesson_activities to authenticated;
create policy lesson_activities_select on public.lesson_activities for select to authenticated using(private.allowed('lesson_activities',to_jsonb(lesson_activities),false));
create policy lesson_activities_insert on public.lesson_activities for insert to authenticated with check(created_by=auth.uid() and private.allowed('lesson_activities',to_jsonb(lesson_activities),true));
create policy lesson_activities_update on public.lesson_activities for update to authenticated using(private.allowed('lesson_activities',to_jsonb(lesson_activities),true)) with check(private.allowed('lesson_activities',to_jsonb(lesson_activities),true));
create policy lesson_activities_delete on public.lesson_activities for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.lesson_activities for each row execute function private.stamp_record();
create index lesson_activities_workspace_updated on public.lesson_activities(workspace_id,updated_at,id);

alter table public.error_types enable row level security;
revoke all on public.error_types from anon, authenticated;
grant select, insert, update on public.error_types to authenticated;
create policy error_types_select on public.error_types for select to authenticated using(private.allowed('error_types',to_jsonb(error_types),false));
create policy error_types_insert on public.error_types for insert to authenticated with check(created_by=auth.uid() and private.allowed('error_types',to_jsonb(error_types),true));
create policy error_types_update on public.error_types for update to authenticated using(private.allowed('error_types',to_jsonb(error_types),true)) with check(private.allowed('error_types',to_jsonb(error_types),true));
create policy error_types_delete on public.error_types for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.error_types for each row execute function private.stamp_record();
create index error_types_workspace_updated on public.error_types(workspace_id,updated_at,id);

alter table public.assignments enable row level security;
revoke all on public.assignments from anon, authenticated;
grant select, insert, update on public.assignments to authenticated;
create policy assignments_select on public.assignments for select to authenticated using(private.allowed('assignments',to_jsonb(assignments),false));
create policy assignments_insert on public.assignments for insert to authenticated with check(created_by=auth.uid() and private.allowed('assignments',to_jsonb(assignments),true));
create policy assignments_update on public.assignments for update to authenticated using(private.allowed('assignments',to_jsonb(assignments),true)) with check(private.allowed('assignments',to_jsonb(assignments),true));
create policy assignments_delete on public.assignments for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.assignments for each row execute function private.stamp_record();
create index assignments_workspace_updated on public.assignments(workspace_id,updated_at,id);

alter table public.assignment_topics enable row level security;
revoke all on public.assignment_topics from anon, authenticated;
grant select, insert, update on public.assignment_topics to authenticated;
create policy assignment_topics_select on public.assignment_topics for select to authenticated using(private.allowed('assignment_topics',to_jsonb(assignment_topics),false));
create policy assignment_topics_insert on public.assignment_topics for insert to authenticated with check(created_by=auth.uid() and private.allowed('assignment_topics',to_jsonb(assignment_topics),true));
create policy assignment_topics_update on public.assignment_topics for update to authenticated using(private.allowed('assignment_topics',to_jsonb(assignment_topics),true)) with check(private.allowed('assignment_topics',to_jsonb(assignment_topics),true));
create policy assignment_topics_delete on public.assignment_topics for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.assignment_topics for each row execute function private.stamp_record();
create index assignment_topics_workspace_updated on public.assignment_topics(workspace_id,updated_at,id);

alter table public.assignment_exercises enable row level security;
revoke all on public.assignment_exercises from anon, authenticated;
grant select, insert, update on public.assignment_exercises to authenticated;
create policy assignment_exercises_select on public.assignment_exercises for select to authenticated using(private.allowed('assignment_exercises',to_jsonb(assignment_exercises),false));
create policy assignment_exercises_insert on public.assignment_exercises for insert to authenticated with check(created_by=auth.uid() and private.allowed('assignment_exercises',to_jsonb(assignment_exercises),true));
create policy assignment_exercises_update on public.assignment_exercises for update to authenticated using(private.allowed('assignment_exercises',to_jsonb(assignment_exercises),true)) with check(private.allowed('assignment_exercises',to_jsonb(assignment_exercises),true));
create policy assignment_exercises_delete on public.assignment_exercises for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.assignment_exercises for each row execute function private.stamp_record();
create index assignment_exercises_workspace_updated on public.assignment_exercises(workspace_id,updated_at,id);

alter table public.homework_checks enable row level security;
revoke all on public.homework_checks from anon, authenticated;
grant select, insert, update on public.homework_checks to authenticated;
create policy homework_checks_select on public.homework_checks for select to authenticated using(private.allowed('homework_checks',to_jsonb(homework_checks),false));
create policy homework_checks_insert on public.homework_checks for insert to authenticated with check(created_by=auth.uid() and private.allowed('homework_checks',to_jsonb(homework_checks),true));
create policy homework_checks_update on public.homework_checks for update to authenticated using(private.allowed('homework_checks',to_jsonb(homework_checks),true)) with check(private.allowed('homework_checks',to_jsonb(homework_checks),true));
create policy homework_checks_delete on public.homework_checks for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.homework_checks for each row execute function private.stamp_record();
create index homework_checks_workspace_updated on public.homework_checks(workspace_id,updated_at,id);

alter table public.homework_exercise_results enable row level security;
revoke all on public.homework_exercise_results from anon, authenticated;
grant select, insert, update on public.homework_exercise_results to authenticated;
create policy homework_exercise_results_select on public.homework_exercise_results for select to authenticated using(private.allowed('homework_exercise_results',to_jsonb(homework_exercise_results),false));
create policy homework_exercise_results_insert on public.homework_exercise_results for insert to authenticated with check(created_by=auth.uid() and private.allowed('homework_exercise_results',to_jsonb(homework_exercise_results),true));
create policy homework_exercise_results_update on public.homework_exercise_results for update to authenticated using(private.allowed('homework_exercise_results',to_jsonb(homework_exercise_results),true)) with check(private.allowed('homework_exercise_results',to_jsonb(homework_exercise_results),true));
create policy homework_exercise_results_delete on public.homework_exercise_results for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.homework_exercise_results for each row execute function private.stamp_record();
create index homework_exercise_results_workspace_updated on public.homework_exercise_results(workspace_id,updated_at,id);

alter table public.homework_errors enable row level security;
revoke all on public.homework_errors from anon, authenticated;
grant select, insert, update on public.homework_errors to authenticated;
create policy homework_errors_select on public.homework_errors for select to authenticated using(private.allowed('homework_errors',to_jsonb(homework_errors),false));
create policy homework_errors_insert on public.homework_errors for insert to authenticated with check(created_by=auth.uid() and private.allowed('homework_errors',to_jsonb(homework_errors),true));
create policy homework_errors_update on public.homework_errors for update to authenticated using(private.allowed('homework_errors',to_jsonb(homework_errors),true)) with check(private.allowed('homework_errors',to_jsonb(homework_errors),true));
create policy homework_errors_delete on public.homework_errors for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.homework_errors for each row execute function private.stamp_record();
create index homework_errors_workspace_updated on public.homework_errors(workspace_id,updated_at,id);

alter table public.observation_types enable row level security;
revoke all on public.observation_types from anon, authenticated;
grant select, insert, update on public.observation_types to authenticated;
create policy observation_types_select on public.observation_types for select to authenticated using(private.allowed('observation_types',to_jsonb(observation_types),false));
create policy observation_types_insert on public.observation_types for insert to authenticated with check(created_by=auth.uid() and private.allowed('observation_types',to_jsonb(observation_types),true));
create policy observation_types_update on public.observation_types for update to authenticated using(private.allowed('observation_types',to_jsonb(observation_types),true)) with check(private.allowed('observation_types',to_jsonb(observation_types),true));
create policy observation_types_delete on public.observation_types for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.observation_types for each row execute function private.stamp_record();
create index observation_types_workspace_updated on public.observation_types(workspace_id,updated_at,id);

alter table public.observations enable row level security;
revoke all on public.observations from anon, authenticated;
grant select, insert, update on public.observations to authenticated;
create policy observations_select on public.observations for select to authenticated using(private.allowed('observations',to_jsonb(observations),false));
create policy observations_insert on public.observations for insert to authenticated with check(created_by=auth.uid() and private.allowed('observations',to_jsonb(observations),true));
create policy observations_update on public.observations for update to authenticated using(private.allowed('observations',to_jsonb(observations),true)) with check(private.allowed('observations',to_jsonb(observations),true));
create policy observations_delete on public.observations for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.observations for each row execute function private.stamp_record();
create index observations_workspace_updated on public.observations(workspace_id,updated_at,id);

alter table public.observation_errors enable row level security;
revoke all on public.observation_errors from anon, authenticated;
grant select, insert, update on public.observation_errors to authenticated;
create policy observation_errors_select on public.observation_errors for select to authenticated using(private.allowed('observation_errors',to_jsonb(observation_errors),false));
create policy observation_errors_insert on public.observation_errors for insert to authenticated with check(created_by=auth.uid() and private.allowed('observation_errors',to_jsonb(observation_errors),true));
create policy observation_errors_update on public.observation_errors for update to authenticated using(private.allowed('observation_errors',to_jsonb(observation_errors),true)) with check(private.allowed('observation_errors',to_jsonb(observation_errors),true));
create policy observation_errors_delete on public.observation_errors for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.observation_errors for each row execute function private.stamp_record();
create index observation_errors_workspace_updated on public.observation_errors(workspace_id,updated_at,id);

alter table public.observation_competencies enable row level security;
revoke all on public.observation_competencies from anon, authenticated;
grant select, insert, update on public.observation_competencies to authenticated;
create policy observation_competencies_select on public.observation_competencies for select to authenticated using(private.allowed('observation_competencies',to_jsonb(observation_competencies),false));
create policy observation_competencies_insert on public.observation_competencies for insert to authenticated with check(created_by=auth.uid() and private.allowed('observation_competencies',to_jsonb(observation_competencies),true));
create policy observation_competencies_update on public.observation_competencies for update to authenticated using(private.allowed('observation_competencies',to_jsonb(observation_competencies),true)) with check(private.allowed('observation_competencies',to_jsonb(observation_competencies),true));
create policy observation_competencies_delete on public.observation_competencies for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.observation_competencies for each row execute function private.stamp_record();
create index observation_competencies_workspace_updated on public.observation_competencies(workspace_id,updated_at,id);

alter table public.observation_topics enable row level security;
revoke all on public.observation_topics from anon, authenticated;
grant select, insert, update on public.observation_topics to authenticated;
create policy observation_topics_select on public.observation_topics for select to authenticated using(private.allowed('observation_topics',to_jsonb(observation_topics),false));
create policy observation_topics_insert on public.observation_topics for insert to authenticated with check(created_by=auth.uid() and private.allowed('observation_topics',to_jsonb(observation_topics),true));
create policy observation_topics_update on public.observation_topics for update to authenticated using(private.allowed('observation_topics',to_jsonb(observation_topics),true)) with check(private.allowed('observation_topics',to_jsonb(observation_topics),true));
create policy observation_topics_delete on public.observation_topics for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.observation_topics for each row execute function private.stamp_record();
create index observation_topics_workspace_updated on public.observation_topics(workspace_id,updated_at,id);

alter table public.assessment_rubrics enable row level security;
revoke all on public.assessment_rubrics from anon, authenticated;
grant select, insert, update on public.assessment_rubrics to authenticated;
create policy assessment_rubrics_select on public.assessment_rubrics for select to authenticated using(private.allowed('assessment_rubrics',to_jsonb(assessment_rubrics),false));
create policy assessment_rubrics_insert on public.assessment_rubrics for insert to authenticated with check(created_by=auth.uid() and private.allowed('assessment_rubrics',to_jsonb(assessment_rubrics),true));
create policy assessment_rubrics_update on public.assessment_rubrics for update to authenticated using(private.allowed('assessment_rubrics',to_jsonb(assessment_rubrics),true)) with check(private.allowed('assessment_rubrics',to_jsonb(assessment_rubrics),true));
create policy assessment_rubrics_delete on public.assessment_rubrics for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.assessment_rubrics for each row execute function private.stamp_record();
create index assessment_rubrics_workspace_updated on public.assessment_rubrics(workspace_id,updated_at,id);

alter table public.rubric_criteria enable row level security;
revoke all on public.rubric_criteria from anon, authenticated;
grant select, insert, update on public.rubric_criteria to authenticated;
create policy rubric_criteria_select on public.rubric_criteria for select to authenticated using(private.allowed('rubric_criteria',to_jsonb(rubric_criteria),false));
create policy rubric_criteria_insert on public.rubric_criteria for insert to authenticated with check(created_by=auth.uid() and private.allowed('rubric_criteria',to_jsonb(rubric_criteria),true));
create policy rubric_criteria_update on public.rubric_criteria for update to authenticated using(private.allowed('rubric_criteria',to_jsonb(rubric_criteria),true)) with check(private.allowed('rubric_criteria',to_jsonb(rubric_criteria),true));
create policy rubric_criteria_delete on public.rubric_criteria for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.rubric_criteria for each row execute function private.stamp_record();
create index rubric_criteria_workspace_updated on public.rubric_criteria(workspace_id,updated_at,id);

alter table public.assessments enable row level security;
revoke all on public.assessments from anon, authenticated;
grant select, insert, update on public.assessments to authenticated;
create policy assessments_select on public.assessments for select to authenticated using(private.allowed('assessments',to_jsonb(assessments),false));
create policy assessments_insert on public.assessments for insert to authenticated with check(created_by=auth.uid() and private.allowed('assessments',to_jsonb(assessments),true));
create policy assessments_update on public.assessments for update to authenticated using(private.allowed('assessments',to_jsonb(assessments),true)) with check(private.allowed('assessments',to_jsonb(assessments),true));
create policy assessments_delete on public.assessments for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.assessments for each row execute function private.stamp_record();
create index assessments_workspace_updated on public.assessments(workspace_id,updated_at,id);

alter table public.assessment_questions enable row level security;
revoke all on public.assessment_questions from anon, authenticated;
grant select, insert, update on public.assessment_questions to authenticated;
create policy assessment_questions_select on public.assessment_questions for select to authenticated using(private.allowed('assessment_questions',to_jsonb(assessment_questions),false));
create policy assessment_questions_insert on public.assessment_questions for insert to authenticated with check(created_by=auth.uid() and private.allowed('assessment_questions',to_jsonb(assessment_questions),true));
create policy assessment_questions_update on public.assessment_questions for update to authenticated using(private.allowed('assessment_questions',to_jsonb(assessment_questions),true)) with check(private.allowed('assessment_questions',to_jsonb(assessment_questions),true));
create policy assessment_questions_delete on public.assessment_questions for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.assessment_questions for each row execute function private.stamp_record();
create index assessment_questions_workspace_updated on public.assessment_questions(workspace_id,updated_at,id);

alter table public.assessment_results enable row level security;
revoke all on public.assessment_results from anon, authenticated;
grant select, insert, update on public.assessment_results to authenticated;
create policy assessment_results_select on public.assessment_results for select to authenticated using(private.allowed('assessment_results',to_jsonb(assessment_results),false));
create policy assessment_results_insert on public.assessment_results for insert to authenticated with check(created_by=auth.uid() and private.allowed('assessment_results',to_jsonb(assessment_results),true));
create policy assessment_results_update on public.assessment_results for update to authenticated using(private.allowed('assessment_results',to_jsonb(assessment_results),true)) with check(private.allowed('assessment_results',to_jsonb(assessment_results),true));
create policy assessment_results_delete on public.assessment_results for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.assessment_results for each row execute function private.stamp_record();
create index assessment_results_workspace_updated on public.assessment_results(workspace_id,updated_at,id);

alter table public.question_results enable row level security;
revoke all on public.question_results from anon, authenticated;
grant select, insert, update on public.question_results to authenticated;
create policy question_results_select on public.question_results for select to authenticated using(private.allowed('question_results',to_jsonb(question_results),false));
create policy question_results_insert on public.question_results for insert to authenticated with check(created_by=auth.uid() and private.allowed('question_results',to_jsonb(question_results),true));
create policy question_results_update on public.question_results for update to authenticated using(private.allowed('question_results',to_jsonb(question_results),true)) with check(private.allowed('question_results',to_jsonb(question_results),true));
create policy question_results_delete on public.question_results for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.question_results for each row execute function private.stamp_record();
create index question_results_workspace_updated on public.question_results(workspace_id,updated_at,id);

alter table public.question_errors enable row level security;
revoke all on public.question_errors from anon, authenticated;
grant select, insert, update on public.question_errors to authenticated;
create policy question_errors_select on public.question_errors for select to authenticated using(private.allowed('question_errors',to_jsonb(question_errors),false));
create policy question_errors_insert on public.question_errors for insert to authenticated with check(created_by=auth.uid() and private.allowed('question_errors',to_jsonb(question_errors),true));
create policy question_errors_update on public.question_errors for update to authenticated using(private.allowed('question_errors',to_jsonb(question_errors),true)) with check(private.allowed('question_errors',to_jsonb(question_errors),true));
create policy question_errors_delete on public.question_errors for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.question_errors for each row execute function private.stamp_record();
create index question_errors_workspace_updated on public.question_errors(workspace_id,updated_at,id);

alter table public.rubric_scores enable row level security;
revoke all on public.rubric_scores from anon, authenticated;
grant select, insert, update on public.rubric_scores to authenticated;
create policy rubric_scores_select on public.rubric_scores for select to authenticated using(private.allowed('rubric_scores',to_jsonb(rubric_scores),false));
create policy rubric_scores_insert on public.rubric_scores for insert to authenticated with check(created_by=auth.uid() and private.allowed('rubric_scores',to_jsonb(rubric_scores),true));
create policy rubric_scores_update on public.rubric_scores for update to authenticated using(private.allowed('rubric_scores',to_jsonb(rubric_scores),true)) with check(private.allowed('rubric_scores',to_jsonb(rubric_scores),true));
create policy rubric_scores_delete on public.rubric_scores for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.rubric_scores for each row execute function private.stamp_record();
create index rubric_scores_workspace_updated on public.rubric_scores(workspace_id,updated_at,id);

alter table public.evaluation_categories enable row level security;
revoke all on public.evaluation_categories from anon, authenticated;
grant select, insert, update on public.evaluation_categories to authenticated;
create policy evaluation_categories_select on public.evaluation_categories for select to authenticated using(private.allowed('evaluation_categories',to_jsonb(evaluation_categories),false));
create policy evaluation_categories_insert on public.evaluation_categories for insert to authenticated with check(created_by=auth.uid() and private.allowed('evaluation_categories',to_jsonb(evaluation_categories),true));
create policy evaluation_categories_update on public.evaluation_categories for update to authenticated using(private.allowed('evaluation_categories',to_jsonb(evaluation_categories),true)) with check(private.allowed('evaluation_categories',to_jsonb(evaluation_categories),true));
create policy evaluation_categories_delete on public.evaluation_categories for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.evaluation_categories for each row execute function private.stamp_record();
create index evaluation_categories_workspace_updated on public.evaluation_categories(workspace_id,updated_at,id);

alter table public.evaluation_rules enable row level security;
revoke all on public.evaluation_rules from anon, authenticated;
grant select, insert, update on public.evaluation_rules to authenticated;
create policy evaluation_rules_select on public.evaluation_rules for select to authenticated using(private.allowed('evaluation_rules',to_jsonb(evaluation_rules),false));
create policy evaluation_rules_insert on public.evaluation_rules for insert to authenticated with check(created_by=auth.uid() and private.allowed('evaluation_rules',to_jsonb(evaluation_rules),true));
create policy evaluation_rules_update on public.evaluation_rules for update to authenticated using(private.allowed('evaluation_rules',to_jsonb(evaluation_rules),true)) with check(private.allowed('evaluation_rules',to_jsonb(evaluation_rules),true));
create policy evaluation_rules_delete on public.evaluation_rules for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.evaluation_rules for each row execute function private.stamp_record();
create index evaluation_rules_workspace_updated on public.evaluation_rules(workspace_id,updated_at,id);

alter table public.grade_entries enable row level security;
revoke all on public.grade_entries from anon, authenticated;
grant select, insert, update on public.grade_entries to authenticated;
create policy grade_entries_select on public.grade_entries for select to authenticated using(private.allowed('grade_entries',to_jsonb(grade_entries),false));
create policy grade_entries_insert on public.grade_entries for insert to authenticated with check(created_by=auth.uid() and private.allowed('grade_entries',to_jsonb(grade_entries),true));
create policy grade_entries_update on public.grade_entries for update to authenticated using(private.allowed('grade_entries',to_jsonb(grade_entries),true)) with check(private.allowed('grade_entries',to_jsonb(grade_entries),true));
create policy grade_entries_delete on public.grade_entries for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.grade_entries for each row execute function private.stamp_record();
create index grade_entries_workspace_updated on public.grade_entries(workspace_id,updated_at,id);

alter table public.ai_workspace_settings enable row level security;
revoke all on public.ai_workspace_settings from anon, authenticated;
grant select, insert, update on public.ai_workspace_settings to authenticated;
create policy ai_workspace_settings_select on public.ai_workspace_settings for select to authenticated using(private.allowed('ai_workspace_settings',to_jsonb(ai_workspace_settings),false));
create policy ai_workspace_settings_insert on public.ai_workspace_settings for insert to authenticated with check(created_by=auth.uid() and private.allowed('ai_workspace_settings',to_jsonb(ai_workspace_settings),true));
create policy ai_workspace_settings_update on public.ai_workspace_settings for update to authenticated using(private.allowed('ai_workspace_settings',to_jsonb(ai_workspace_settings),true)) with check(private.allowed('ai_workspace_settings',to_jsonb(ai_workspace_settings),true));
create policy ai_workspace_settings_delete on public.ai_workspace_settings for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.ai_workspace_settings for each row execute function private.stamp_record();
create index ai_workspace_settings_workspace_updated on public.ai_workspace_settings(workspace_id,updated_at,id);

alter table public.ai_requests enable row level security;
revoke all on public.ai_requests from anon, authenticated;
grant select, insert, update on public.ai_requests to authenticated;
create policy ai_requests_select on public.ai_requests for select to authenticated using(private.allowed('ai_requests',to_jsonb(ai_requests),false));
create policy ai_requests_insert on public.ai_requests for insert to authenticated with check(created_by=auth.uid() and private.allowed('ai_requests',to_jsonb(ai_requests),true));
create policy ai_requests_update on public.ai_requests for update to authenticated using(private.allowed('ai_requests',to_jsonb(ai_requests),true)) with check(private.allowed('ai_requests',to_jsonb(ai_requests),true));
create policy ai_requests_delete on public.ai_requests for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.ai_requests for each row execute function private.stamp_record();
create index ai_requests_workspace_updated on public.ai_requests(workspace_id,updated_at,id);

alter table public.import_batches enable row level security;
revoke all on public.import_batches from anon, authenticated;
grant select, insert, update on public.import_batches to authenticated;
create policy import_batches_select on public.import_batches for select to authenticated using(private.allowed('import_batches',to_jsonb(import_batches),false));
create policy import_batches_insert on public.import_batches for insert to authenticated with check(created_by=auth.uid() and private.allowed('import_batches',to_jsonb(import_batches),true));
create policy import_batches_update on public.import_batches for update to authenticated using(private.allowed('import_batches',to_jsonb(import_batches),true)) with check(private.allowed('import_batches',to_jsonb(import_batches),true));
create policy import_batches_delete on public.import_batches for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.import_batches for each row execute function private.stamp_record();
create index import_batches_workspace_updated on public.import_batches(workspace_id,updated_at,id);

alter table public.import_rows enable row level security;
revoke all on public.import_rows from anon, authenticated;
grant select, insert, update on public.import_rows to authenticated;
create policy import_rows_select on public.import_rows for select to authenticated using(private.allowed('import_rows',to_jsonb(import_rows),false));
create policy import_rows_insert on public.import_rows for insert to authenticated with check(created_by=auth.uid() and private.allowed('import_rows',to_jsonb(import_rows),true));
create policy import_rows_update on public.import_rows for update to authenticated using(private.allowed('import_rows',to_jsonb(import_rows),true)) with check(private.allowed('import_rows',to_jsonb(import_rows),true));
create policy import_rows_delete on public.import_rows for delete to authenticated using(false);
create trigger stamp_record before insert or update on public.import_rows for each row execute function private.stamp_record();
create index import_rows_workspace_updated on public.import_rows(workspace_id,updated_at,id);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
revoke all on public.profiles,public.workspaces,public.workspace_members from anon,authenticated;
grant select on public.profiles,public.workspaces,public.workspace_members to authenticated;
grant update(display_name,version) on public.profiles to authenticated;
grant update(name,version) on public.workspaces to authenticated;
create policy profiles_select on public.profiles for select to authenticated using(id=auth.uid());
create policy profiles_insert on public.profiles for insert to authenticated with check(false);
create policy profiles_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy profiles_delete on public.profiles for delete to authenticated using(false);
create policy workspaces_select on public.workspaces for select to authenticated using(private.member_role(id) is not null);
create policy workspaces_insert on public.workspaces for insert to authenticated with check(false);
create policy workspaces_update on public.workspaces for update to authenticated using(private.member_role(id) in ('owner','admin')) with check(private.member_role(id) in ('owner','admin'));
create policy workspaces_delete on public.workspaces for delete to authenticated using(false);
create policy members_select on public.workspace_members for select to authenticated using(private.member_role(workspace_id) is not null);
create policy members_insert on public.workspace_members for insert to authenticated with check(false);
create policy members_update on public.workspace_members for update to authenticated using(false) with check(false);
create policy members_delete on public.workspace_members for delete to authenticated using(false);
create function private.stamp_account() returns trigger language plpgsql set search_path='' as $$
begin
 if new.version<>old.version+1 then raise exception 'Version conflict' using errcode='40001'; end if;
 new.updated_at:=clock_timestamp(); return new;
end $$;
create trigger stamp_account before update on public.profiles for each row execute function private.stamp_account();
create trigger stamp_account before update on public.workspaces for each row execute function private.stamp_account();

create function public.set_workspace_member(p_workspace uuid,p_user uuid,p_role text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.workspaces where id=p_workspace for update;
 if private.member_role(p_workspace)<>'owner' or private.member_role(p_workspace) is null then raise exception 'Owner required' using errcode='42501'; end if;
 if p_role not in ('admin','teacher','viewer') or p_role is null or p_user=auth.uid() then raise exception 'Invalid role change' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles where id=p_user) then raise exception 'Existing invited user required'; end if;
 insert into public.workspace_members(workspace_id,user_id,role) values(p_workspace,p_user,p_role)
 on conflict(workspace_id,user_id) do update set role=excluded.role;
end $$;
revoke all on function public.set_workspace_member(uuid,uuid,text) from public,anon;
grant execute on function public.set_workspace_member(uuid,uuid,text) to authenticated;
