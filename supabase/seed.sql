-- LOCAL ONLY. Never use --include-seed for a cloud push.
do $$
declare u uuid; w uuid; sy uuid; school uuid; math uuid; physics uuid; cls uuid; cs uuid; ta uuid;
 stu uuid; enr uuid; lesson uuid; topic uuid; competency uuid; ass uuid; ex1 uuid; ex2 uuid; hc uuid;
 ot uuid; obs uuid; assessed uuid; question uuid; result uuid; cat uuid; rule uuid; n integer; j integer; k integer;
begin
for n in 1..2 loop
 u:=case n when 1 then '11111111-1111-4111-8111-111111111111'::uuid else '22222222-2222-4222-8222-222222222222'::uuid end;
 insert into auth.users(id,email,raw_user_meta_data) values(u,'docente'||n||'@example.invalid',jsonb_build_object('display_name','Docente fittizio '||n));
 select id into w from public.workspaces where owner_id=u;
 insert into public.school_years(workspace_id,created_by,label,starts_on,ends_on) values(w,u,'2026/2027','2026-09-01','2027-08-31') returning id into sy;
 insert into public.schools(workspace_id,created_by,name,code) values(w,u,'Istituto Fittizio '||n,'TEST-'||n) returning id into school;
 insert into public.subjects(workspace_id,created_by,name,code) values(w,u,'Matematica','MAT') returning id into math;
 insert into public.subjects(workspace_id,created_by,name,code) values(w,u,'Fisica','FIS') returning id into physics;
 insert into public.evaluation_categories(workspace_id,created_by,code,name) values(w,u,'written','Verifiche scritte') returning id into cat;
 insert into public.evaluation_categories(workspace_id,created_by,code,name) values(w,u,'oral','Interrogazioni');
 insert into public.evaluation_categories(workspace_id,created_by,code,name,contributes_to_average) values(w,u,'observation','Osservazioni',false);
 insert into public.evaluation_categories(workspace_id,created_by,code,name) values(w,u,'practical','Prove pratiche'),(w,u,'homework','Compiti valutati');
 insert into public.evaluation_rules(workspace_id,created_by,name,minimum,maximum) values(w,u,'Scala decimale dimostrativa',1,10) returning id into rule;
 insert into public.observation_types(workspace_id,created_by,code,description,disciplinary_default) values(w,u,'disciplinary','Comprensione disciplinare',true) returning id into ot;
 insert into public.observation_types(workspace_id,created_by,code,description) values(w,u,'participation','Partecipazione'),(w,u,'behavior','Comportamento');
 insert into public.topics(workspace_id,created_by,subject_id,name) values(w,u,math,'Equazioni lineari') returning id into topic;
 insert into public.competencies(workspace_id,created_by,subject_id,code,description) values(w,u,math,'ALG-1','Risolvere equazioni') returning id into competency;
 insert into public.ai_workspace_settings(workspace_id,created_by) values(w,u);
 for j in 1..case n when 1 then 2 else 1 end loop
  insert into public.classes(workspace_id,created_by,school_id,school_year_id,name) values(w,u,school,sy,j||'A') returning id into cls;
  insert into public.class_subjects(workspace_id,created_by,class_id,subject_id) values(w,u,cls,math) returning id into cs;
  insert into public.teaching_assignments(workspace_id,created_by,class_subject_id,class_id,teacher_id) values(w,u,cs,cls,u) returning id into ta;
  insert into public.class_subjects(workspace_id,created_by,class_id,subject_id) values(w,u,cls,physics) returning id into cs;
  insert into public.teaching_assignments(workspace_id,created_by,class_subject_id,class_id,teacher_id) values(w,u,cs,cls,u);
  for k in 1..5 loop
   insert into public.students(workspace_id,created_by,external_code,first_name,last_name) values(w,u,'TEST-'||j||'-'||k,'NomeInventato'||k,'CognomeInventato'||j) returning id into stu;
   insert into public.enrollments(workspace_id,created_by,student_id,class_id,starts_on) values(w,u,stu,cls,'2026-09-15') returning id into enr;
  end loop;
  insert into public.lessons(workspace_id,created_by,teaching_assignment_id,starts_at,ends_at,title,status) values(w,u,ta,'2026-10-20 08:00+02','2026-10-20 09:00+02','Equazioni di primo grado','confirmed') returning id into lesson;
  insert into public.lesson_topics(workspace_id,created_by,lesson_id,topic_id) values(w,u,lesson,topic);
  insert into public.lesson_activities(workspace_id,created_by,lesson_id,description) values(w,u,lesson,'Esercizi guidati fittizi');
  insert into public.assignments(workspace_id,created_by,teaching_assignment_id,class_id,title,assigned_on,due_on) values(w,u,ta,cls,'Compito fittizio','2026-10-20','2026-10-22') returning id into ass;
  insert into public.assignment_exercises(workspace_id,created_by,assignment_id,position,description) values(w,u,ass,1,'2x=4') returning id into ex1;
  insert into public.assignment_exercises(workspace_id,created_by,assignment_id,position,description) values(w,u,ass,2,'3x=9') returning id into ex2;
  insert into public.homework_checks(workspace_id,created_by,assignment_id,enrollment_id,class_id,checked_on) values(w,u,ass,enr,cls,'2026-10-22') returning id into hc;
  insert into public.homework_exercise_results(workspace_id,created_by,homework_check_id,assignment_id,exercise_id,outcome) values(w,u,hc,ass,ex1,'correct'),(w,u,hc,ass,ex2,'partial');
  insert into public.observations(workspace_id,created_by,teaching_assignment_id,class_id,enrollment_id,observation_type_id,observed_on,mode,notes) values(w,u,ta,cls,enr,ot,'2026-10-20','DESCRIPTIVE','Esempio qualitativo fittizio');
  insert into public.observations(workspace_id,created_by,teaching_assignment_id,class_id,enrollment_id,observation_type_id,observed_on,mode,notes) values(w,u,ta,cls,enr,ot,'2026-10-21','GRADED','Comprensione osservata') returning id into obs;
  insert into public.grade_entries(workspace_id,created_by,enrollment_id,teaching_assignment_id,class_id,category_id,rule_id,graded_on,origin,observation_id,confirmed_value,status) values(w,u,enr,ta,cls,cat,rule,'2026-10-21','observation',obs,7,'confirmed');
  insert into public.assessments(workspace_id,created_by,teaching_assignment_id,class_id,title,assessed_on,kind,correction_mode) values(w,u,ta,cls,'Verifica fittizia','2026-10-21','written','analytic') returning id into assessed;
  insert into public.assessment_questions(workspace_id,created_by,assessment_id,label,max_score,competency_id,topic_id) values(w,u,assessed,'Q1',10,competency,topic) returning id into question;
  insert into public.assessment_results(workspace_id,created_by,assessment_id,teaching_assignment_id,class_id,enrollment_id) values(w,u,assessed,ta,cls,enr) returning id into result;
  insert into public.question_results(workspace_id,created_by,assessment_result_id,assessment_id,question_id,score,max_score_snapshot) values(w,u,result,assessed,question,8,10);
  insert into public.grade_entries(workspace_id,created_by,enrollment_id,teaching_assignment_id,class_id,category_id,rule_id,graded_on,origin,assessment_result_id,confirmed_value,status) values(w,u,enr,ta,cls,cat,rule,'2026-10-21','assessment',result,8.2,'confirmed');
 end loop;
end loop;
end $$;
