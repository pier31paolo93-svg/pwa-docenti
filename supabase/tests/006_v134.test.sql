begin;
select extensions.no_plan();
create temp table teaching_ctx as select w.id w,w.owner_id u,c.id cls,c.school_id school,t.id ta,
(select id from public.enrollments where class_id=c.id and deleted_at is null limit 1) enr,
(select id from public.topics where workspace_id=w.id and subject_id=(select subject_id from public.class_subjects where id=t.class_subject_id) limit 1) topic,
(select id from public.evaluation_categories where workspace_id=w.id and code='written') category,
(select id from public.evaluation_rules where workspace_id=w.id limit 1) rule,
(select id from public.lessons where workspace_id=w.id and teaching_assignment_id=t.id limit 1) lesson,
(select id from public.observation_types where workspace_id=w.id limit 1) observation_type
from public.workspaces w join public.classes c on c.workspace_id=w.id join public.teaching_assignments t on t.class_id=c.id where w.owner_id='11111111-1111-4111-8111-111111111111' and exists(select 1 from public.lessons where teaching_assignment_id=t.id) limit 1;
alter table teaching_ctx add column recovery uuid default gen_random_uuid(),add column assessment uuid default gen_random_uuid(),add column result uuid default gen_random_uuid(),add column question uuid default gen_random_uuid(),add column import_id uuid default gen_random_uuid(),add column plan jsonb;
grant select,update on teaching_ctx to authenticated;
select extensions.ok(not has_table_privilege('anon','public.recovery_activities','SELECT'),'Recovery anonymous denied');
select extensions.ok(not has_table_privilege('authenticated','public.record_audit_log','INSERT'),'Audit cannot be forged');
select extensions.ok(not has_function_privilege('anon','public.apply_student_import(uuid,uuid,text,jsonb)','EXECUTE'),'Import anonymous denied');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);set local role authenticated;
insert into public.recovery_activities(id,workspace_id,teaching_assignment_id,class_id,topic_id,title,objective,due_on) select recovery,w,ta,cls,topic,'Recupero fittizio','Obiettivo fittizio','2026-10-30' from teaching_ctx;
insert into public.recovery_students(workspace_id,activity_id,class_id,enrollment_id) select w,recovery,cls,enr from teaching_ctx;
select extensions.ok(exists(select 1 from public.recovery_students where activity_id=(select recovery from teaching_ctx)),'Real recovery assignment persisted');
select extensions.lives_ok($q$select public.frontend_sync_mutation(gen_random_uuid(),'recovery_activities',recovery,w,1,'{"status":"in_progress"}') from teaching_ctx$q$,'Recovery uses canonical offline mutation RPC');
select extensions.throws_ok($q$select public.frontend_sync_mutation(gen_random_uuid(),'recovery_activities',recovery,w,1,'{"status":"completed"}') from teaching_ctx$q$,'PT409',null,'Stale recovery update conflicts');
insert into public.observations(workspace_id,teaching_assignment_id,class_id,enrollment_id,observation_type_id,observed_on,mode,notes,participation,daily_lesson_id) select w,ta,cls,enr,observation_type,'2026-10-20','DESCRIPTIVE','Nota fittizia','Intervento fittizio',lesson from teaching_ctx;
select extensions.throws_ok($q$insert into public.observations(workspace_id,teaching_assignment_id,class_id,enrollment_id,observation_type_id,observed_on,mode,daily_lesson_id) select w,ta,cls,enr,observation_type,'2026-10-21','DESCRIPTIVE',lesson from teaching_ctx$q$,'23514',null,'Daily observation matches actual lesson date');
select extensions.throws_ok($q$insert into public.observations(workspace_id,teaching_assignment_id,class_id,enrollment_id,observation_type_id,observed_on,mode,daily_lesson_id) select w,ta,cls,enr,observation_type,'2026-10-20','DESCRIPTIVE',lesson from teaching_ctx$q$,'23505',null,'Daily annotation cannot duplicate same lesson/student');
update public.homework_checks set daily_status='unchecked',version=version+1 where workspace_id=(select w from teaching_ctx);
select extensions.ok(not exists(select 1 from public.v_homework_completion where workspace_id=(select w from teaching_ctx) and (completion_status<>'unchecked' or completed_percent is not null)),'Unchecked is not zero or not-done');
update public.homework_checks set daily_status='not_done',version=version+1 where workspace_id=(select w from teaching_ctx);
select extensions.ok(not exists(select 1 from public.v_homework_completion where workspace_id=(select w from teaching_ctx) and (completion_status<>'not_done' or completed_percent<>0)),'Not done is explicit zero completion');
update public.homework_exercise_results set version=version+1 where workspace_id=(select w from teaching_ctx);
select extensions.ok(not exists(select 1 from public.homework_checks h where h.workspace_id=(select w from teaching_ctx) and h.daily_status is not null and exists(select 1 from public.homework_exercise_results e where e.homework_check_id=h.id)),'Detailed homework corrections supersede daily summaries');
insert into public.assessments(id,workspace_id,teaching_assignment_id,class_id,title,assessed_on,kind,correction_mode) select assessment,w,ta,cls,'Prova assenza fittizia','2026-10-23','written','analytic' from teaching_ctx;
insert into public.assessment_results(id,workspace_id,teaching_assignment_id,class_id,assessment_id,enrollment_id,attendance) select result,w,ta,cls,assessment,enr,'absent' from teaching_ctx;
select extensions.is((select count(*)::integer from public.question_results where assessment_result_id=(select result from teaching_ctx)),0,'Uncorrected exercise has no invented score');
insert into public.assessment_questions(id,workspace_id,assessment_id,label,max_score) select question,w,assessment,'Q1',10 from teaching_ctx;
insert into public.question_results(workspace_id,assessment_id,assessment_result_id,question_id,max_score_snapshot,score) select w,assessment,result,question,10,8 from teaching_ctx;
select extensions.throws_ok($q$insert into public.grade_entries(workspace_id,enrollment_id,class_id,teaching_assignment_id,rule_id,category_id,graded_on,origin,assessment_result_id,status,confirmed_value) select w,enr,cls,ta,rule,category,'2026-10-23','assessment',result,'confirmed',8 from teaching_ctx$q$,'23514','Studente assente: nessuna pubblicazione del voto.','Absent student cannot receive confirmed grade');
update teaching_ctx set plan=jsonb_build_array(jsonb_build_object('action','insert','first_name','ImportFittizio','last_name','Nuovo','external_code','V134-FICTIONAL-IMPORT','class_id',cls,'register_number',99,'starts_on','2026-09-01'));
select extensions.ok((select (public.preview_student_import(w,plan)->>'valid')::boolean from teaching_ctx),'Advanced import validates before writes');
select extensions.ok(not exists(select 1 from public.students where external_code='V134-FICTIONAL-IMPORT'),'Preview does not create student');
select extensions.lives_ok($q$select public.apply_student_import(w,import_id,repeat('a',64),plan) from teaching_ctx$q$,'Atomic import creates canonical student/enrollment');
select extensions.lives_ok($q$select public.apply_student_import(w,gen_random_uuid(),repeat('a',64),plan) from teaching_ctx$q$,'Repeated same file idempotent');
select extensions.is((select count(*)::integer from public.students where external_code='V134-FICTIONAL-IMPORT'),1,'Repeated file creates no duplicate');
select extensions.throws_ok($q$select public.preview_student_import(w,jsonb_set(plan,'{0,external_code}','"V134-DIFFERENT"')) from teaching_ctx$q$,'23505',null,'Occupied register number caught in preview');
select extensions.ok(exists(select 1 from public.record_audit_log where table_name='students' and new_record->>'external_code'='V134-FICTIONAL-IMPORT'),'Import audited canonically');
select extensions.throws_ok($q$select public.preview_student_import(w,jsonb_build_array(jsonb_build_object('first_name','Fake','last_name','Fake','external_code','BAD'))) from teaching_ctx$q$,null,null,'Missing action rejected');
update teaching_ctx set plan=(select jsonb_build_array(jsonb_build_object('action','update','student_id',s.id,'student_version',s.version,'enrollment_version',e.version,'first_name','AggiornatoFittizio','last_name',s.last_name,'external_code',s.external_code,'class_id',e.class_id,'register_number',e.register_number,'starts_on',e.starts_on)) from public.students s join public.enrollments e on e.student_id=s.id where s.external_code='V134-FICTIONAL-IMPORT');
select extensions.lives_ok($q$select public.apply_student_import(w,gen_random_uuid(),repeat('c',64),plan) from teaching_ctx$q$,'Explicit update branch preserves canonical identity');
select extensions.is((select first_name from public.students where external_code='V134-FICTIONAL-IMPORT'),'AggiornatoFittizio','Existing student actually updated');
select extensions.throws_ok($q$select public.preview_student_import(w,plan) from teaching_ctx$q$,'PT409',null,'Stale import version rejected');
select extensions.is((select count(*)::integer from public.import_batches where source_fingerprint=repeat('c',64)),1,'Update creates one batch');
select extensions.throws_ok($q$select public.apply_student_import(w,gen_random_uuid(),repeat('d',64),jsonb_build_array(jsonb_build_object('action','insert','first_name','Atomic','last_name','Fake','external_code','V134-ROLLBACK'),jsonb_build_object('action','insert','first_name','Invalid','last_name','Fake','external_code','V134-ROLLBACK'))) from teaching_ctx$q$,'23505',null,'Invalid batch rejected atomically');
select extensions.is((select count(*)::integer from public.students where external_code='V134-ROLLBACK'),0,'Failed import leaves no partial student');
reset role;alter table teaching_ctx add column undo_event uuid,add column undo_operation uuid default gen_random_uuid(),add column undo_version bigint;set local role authenticated;
update teaching_ctx set undo_event=(select id from public.record_audit_log where table_name='students' and operation='UPDATE' and new_record->>'external_code'='V134-FICTIONAL-IMPORT' order by created_at desc limit 1),undo_version=(select version from public.students where external_code='V134-FICTIONAL-IMPORT');
select extensions.lives_ok($q$select public.undo_record_change(undo_event,undo_version,undo_operation) from teaching_ctx$q$,'Undo restores prior metadata with canonical version checks');
select extensions.is((select first_name from public.students where external_code='V134-FICTIONAL-IMPORT'),'ImportFittizio','Undo restores previous value');
select extensions.lives_ok($q$select public.undo_record_change(undo_event,undo_version,undo_operation) from teaching_ctx$q$,'Undo network retry is idempotent');
select extensions.throws_ok($q$select public.undo_record_change(undo_event,undo_version,gen_random_uuid()) from teaching_ctx$q$,'PT409',null,'New undo against changed version rejected');
reset role;
insert into public.workspace_members(workspace_id,user_id,role) select w,'22222222-2222-4222-8222-222222222222','viewer' from teaching_ctx;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);set local role authenticated;
select extensions.ok(exists(select 1 from public.recovery_students where activity_id=(select recovery from teaching_ctx)),'Viewer can read authorized workspace recovery');
select extensions.throws_ok($q$select public.frontend_sync_mutation(gen_random_uuid(),'recovery_activities',recovery,w,2,'{"status":"completed"}') from teaching_ctx$q$,'42501',null,'Viewer cannot alter recovery');
select extensions.throws_ok($q$select public.preview_student_import(w,plan) from teaching_ctx$q$,'42501',null,'Viewer cannot import');
reset role;update public.workspace_members set role='teacher' where workspace_id=(select w from teaching_ctx) and user_id='22222222-2222-4222-8222-222222222222';set local role authenticated;
select extensions.throws_ok($q$select public.preview_student_import(w,plan) from teaching_ctx$q$,'42501',null,'Teacher cannot import anagraphic data');
select extensions.throws_ok($q$select public.frontend_sync_mutation(gen_random_uuid(),'recovery_activities',recovery,w,2,'{"status":"completed"}') from teaching_ctx$q$,'42501',null,'Unassigned teacher cannot change another teacher recovery');
reset role;delete from public.workspace_members where workspace_id=(select w from teaching_ctx) and user_id='22222222-2222-4222-8222-222222222222';set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select extensions.is((select count(*)::integer from public.recovery_students),0,'Recovery isolated across workspaces');
select extensions.is((select count(*)::integer from public.record_audit_log where workspace_id=(select w from teaching_ctx)),0,'Audit isolated across workspaces');
select extensions.throws_ok($q$select public.apply_student_import(w,gen_random_uuid(),repeat('b',64),plan) from teaching_ctx$q$,'42501',null,'Cross-workspace import forbidden');
reset role;select * from extensions.finish();rollback;
