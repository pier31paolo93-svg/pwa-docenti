create view public.v_grade_register with (security_invoker=true) as
select g.*,e.student_id,cs.subject_id,c.school_year_id,c.school_id,
 (g.status='confirmed' and not g.excluded_from_average and g.deleted_at is null
 and coalesce((g.calculation_snapshot->'category'->>'contributes_to_average')::boolean,false)
 and (g.origin<>'observation' or g.allow_behavior_in_average or
 coalesce((g.calculation_snapshot->'source'->'observation_type'->>'disciplinary_default')::boolean,false))) as included_in_average
from public.grade_entries g join public.enrollments e on (e.workspace_id,e.id)=(g.workspace_id,g.enrollment_id)
join public.teaching_assignments ta on (ta.workspace_id,ta.id)=(g.workspace_id,g.teaching_assignment_id)
join public.class_subjects cs on (cs.workspace_id,cs.id)=(ta.workspace_id,ta.class_subject_id)
join public.classes c on (c.workspace_id,c.id)=(cs.workspace_id,cs.class_id);
create view public.v_student_averages with (security_invoker=true) as
select workspace_id,student_id,subject_id,school_year_id,category_id,
 sum(confirmed_value*weight)/nullif(sum(weight),0) as weighted_average,count(*) as grade_count
from public.v_grade_register where included_in_average
group by workspace_id,student_id,subject_id,school_year_id,category_id;
create view public.v_grade_progression with (security_invoker=true) as
select workspace_id,student_id,subject_id,school_year_id,graded_on,
 sum(confirmed_value*weight)/nullif(sum(weight),0) as daily_average,count(*) as grade_count
from public.v_grade_register where included_in_average group by workspace_id,student_id,subject_id,school_year_id,graded_on;
create view public.v_homework_summary with (security_invoker=true) as
select h.workspace_id,h.id as homework_check_id,h.enrollment_id,h.assignment_id,
 count(ex.id) as total_exercises,
 count(*) filter(where r.outcome='correct') as correct,
 count(*) filter(where r.outcome='wrong') as wrong,
 count(*) filter(where r.outcome='partial') as partial,
 count(ex.id) filter(where r.id is null or r.outcome='not_done') as not_done,
 100.0*count(*) filter(where r.outcome in ('correct','wrong','partial'))/nullif(count(ex.id),0) as completed_percent
from public.homework_checks h
join public.assignment_exercises ex on ex.workspace_id=h.workspace_id and ex.assignment_id=h.assignment_id and ex.deleted_at is null
left join public.homework_exercise_results r on r.workspace_id=h.workspace_id and r.homework_check_id=h.id and r.exercise_id=ex.id and r.deleted_at is null
where h.deleted_at is null group by h.workspace_id,h.id,h.enrollment_id,h.assignment_id;
create view public.v_observation_history with (security_invoker=true) as
select o.*,e.student_id from public.observations o join public.enrollments e on (e.workspace_id,e.id)=(o.workspace_id,o.enrollment_id) where o.deleted_at is null;
create view public.v_assessment_history with (security_invoker=true) as
select r.*,e.student_id,a.title,a.assessed_on,a.kind from public.assessment_results r
join public.enrollments e on (e.workspace_id,e.id)=(r.workspace_id,r.enrollment_id)
join public.assessments a on (a.workspace_id,a.id)=(r.workspace_id,r.assessment_id) where r.deleted_at is null;
create view public.v_recurring_errors with (security_invoker=true) as
select workspace_id,enrollment_id,error_type_id,count(*) as occurrences from (
 select oe.workspace_id,o.enrollment_id,oe.error_type_id from public.observation_errors oe join public.observations o on (o.workspace_id,o.id)=(oe.workspace_id,oe.observation_id) where oe.deleted_at is null and o.deleted_at is null
 union all
 select he.workspace_id,h.enrollment_id,he.error_type_id from public.homework_errors he join public.homework_exercise_results r on (r.workspace_id,r.id)=(he.workspace_id,he.exercise_result_id) join public.homework_checks h on (h.workspace_id,h.id)=(r.workspace_id,r.homework_check_id) where he.deleted_at is null and r.deleted_at is null and h.deleted_at is null
 union all
 select qe.workspace_id,r.enrollment_id,qe.error_type_id from public.question_errors qe join public.question_results q on (q.workspace_id,q.id)=(qe.workspace_id,qe.question_result_id) join public.assessment_results r on (r.workspace_id,r.id)=(q.workspace_id,q.assessment_result_id) where qe.deleted_at is null and q.deleted_at is null and r.deleted_at is null
) errors group by workspace_id,enrollment_id,error_type_id;
create view public.v_competency_progress with (security_invoker=true) as
select r.workspace_id,r.enrollment_id,q.competency_id,
 avg(qr.score/nullif(qr.max_score_snapshot,0)) as average_ratio,count(*) as evidence_count
from public.question_results qr join public.assessment_questions q on (q.workspace_id,q.id)=(qr.workspace_id,qr.question_id)
join public.assessment_results r on (r.workspace_id,r.id)=(qr.workspace_id,qr.assessment_result_id)
where qr.deleted_at is null and q.competency_id is not null and r.deleted_at is null
group by r.workspace_id,r.enrollment_id,q.competency_id;
create view public.v_class_dashboard with (security_invoker=true) as
select workspace_id,class_id,subject_id,school_year_id,count(distinct student_id) as students_with_grades,
 sum(confirmed_value*weight)/nullif(sum(weight),0) as weighted_average,count(*) as grade_count
from public.v_grade_register where included_in_average group by workspace_id,class_id,subject_id,school_year_id;
create view public.v_subject_dashboard with (security_invoker=true) as
select workspace_id,subject_id,school_year_id,sum(confirmed_value*weight)/nullif(sum(weight),0) as weighted_average,count(*) as grade_count
from public.v_grade_register where included_in_average group by workspace_id,subject_id,school_year_id;
create function public.student_average(p_workspace uuid,p_student uuid,p_subject uuid,p_start date,p_end date,p_category uuid default null,p_year uuid default null)
returns numeric language sql stable security invoker set search_path='' as $$
 select sum(confirmed_value*weight)/nullif(sum(weight),0)
 from public.v_grade_register
 where workspace_id=p_workspace and student_id=p_student and subject_id=p_subject
 and included_in_average and graded_on between p_start and p_end
 and (p_category is null or category_id=p_category) and (p_year is null or school_year_id=p_year)
$$;
revoke all on function public.student_average(uuid,uuid,uuid,date,date,uuid,uuid) from public,anon;
grant execute on function public.student_average(uuid,uuid,uuid,date,date,uuid,uuid) to authenticated;
revoke all on public.v_grade_register from public,anon; grant select on public.v_grade_register to authenticated;
revoke all on public.v_student_averages from public,anon; grant select on public.v_student_averages to authenticated;
revoke all on public.v_grade_progression from public,anon; grant select on public.v_grade_progression to authenticated;
revoke all on public.v_homework_summary from public,anon; grant select on public.v_homework_summary to authenticated;
revoke all on public.v_observation_history from public,anon; grant select on public.v_observation_history to authenticated;
revoke all on public.v_assessment_history from public,anon; grant select on public.v_assessment_history to authenticated;
revoke all on public.v_recurring_errors from public,anon; grant select on public.v_recurring_errors to authenticated;
revoke all on public.v_competency_progress from public,anon; grant select on public.v_competency_progress to authenticated;
revoke all on public.v_class_dashboard from public,anon; grant select on public.v_class_dashboard to authenticated;
revoke all on public.v_subject_dashboard from public,anon; grant select on public.v_subject_dashboard to authenticated;

-- No public CREATE capability: prevent function/search-path object injection.
revoke create on schema public from public,anon,authenticated;
revoke all on all functions in schema private from public,anon;
grant execute on function private.member_role(uuid),private.can_read(uuid,uuid,text),private.can_write(uuid,uuid),private.allowed(text,jsonb,boolean,integer) to authenticated;
