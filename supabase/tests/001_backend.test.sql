begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
create schema test_support;
create table test_support.results(label text primary key,passed boolean not null);
create function test_support.ok(value boolean,label text) returns text language plpgsql as $$
begin
 insert into test_support.results values(label,coalesce(value,false));
 if not coalesce(value,false) then raise exception 'FAILED: %',label; end if;
 return '# checked '||label;
end $$;
create function test_support.throws_sqlstate(command text,expected text,label text) returns text language plpgsql as $$
declare actual text;
begin
 begin execute command; exception when others then get stacked diagnostics actual=returned_sqlstate; end;
 if actual is distinct from expected then raise exception 'FAILED: % (expected %, received %)',label,expected,coalesce(actual,'no error'); end if;
 return test_support.ok(actual=expected,label);
end $$;
grant usage on schema test_support to authenticated,anon;
grant select,insert on test_support.results to authenticated,anon;
grant execute on all functions in schema test_support to authenticated,anon;
create temp table ctx(key text primary key,id uuid);
insert into ctx values('u1','11111111-1111-4111-8111-111111111111'),('u2','22222222-2222-4222-8222-222222222222');
insert into ctx select 'w1',id from public.workspaces where owner_id=(select id from ctx where key='u1');
insert into ctx select 'w2',id from public.workspaces where owner_id=(select id from ctx where key='u2');
insert into ctx select 'student1',id from public.students where workspace_id=(select id from ctx where key='w1') limit 1;
insert into ctx select 'student2',id from public.students where workspace_id=(select id from ctx where key='w2') limit 1;
insert into ctx select 'class1',id from public.classes where workspace_id=(select id from ctx where key='w1') limit 1;
insert into ctx select 'grade1',id from public.grade_entries where workspace_id=(select id from ctx where key='w1') and origin='assessment' limit 1;
insert into ctx select 'gradeobs',id from public.grade_entries where workspace_id=(select id from ctx where key='w1') and origin='observation' limit 1;
insert into ctx select 'descriptive',id from public.observations where workspace_id=(select id from ctx where key='w1') and mode='DESCRIPTIVE' limit 1;
insert into ctx select 'assignment1',id from public.teaching_assignments where workspace_id=(select id from ctx where key='w1') limit 1;
insert into ctx select 'classsubject1',class_subject_id from public.teaching_assignments where id=(select id from ctx where key='assignment1');
grant select on ctx to authenticated,anon;
select test_support.ok((select count(*)=2 from public.workspaces where owner_id in ((select id from ctx where key='u1'),(select id from ctx where key='u2'))),'Workspace automatici: due utenti due workspace');
select test_support.ok(not exists(select 1 from public.workspaces w left join public.workspace_members m on m.workspace_id=w.id and m.user_id=w.owner_id and m.role='owner' where m.user_id is null),'Ogni utente Owner del proprio workspace');
select test_support.ok((select count(*)=15 from public.students where workspace_id in ((select id from ctx where key='w1'),(select id from ctx where key='w2'))),'Seed: quindici studenti fittizi');
select test_support.ok((select count(*)=3 from public.classes where workspace_id in ((select id from ctx where key='w1'),(select id from ctx where key='w2'))),'Seed: tre classi');
select test_support.ok(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity),'RLS su tutte le tabelle pubbliche');
select test_support.ok(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v' and not coalesce(c.reloptions @> array['security_invoker=true'],false)),'Viste security_invoker');
select test_support.ok(not exists(select 1 from public.ai_workspace_settings where enabled),'AI disabilitata');
select test_support.throws_sqlstate($q$insert into public.enrollments(workspace_id,created_by,student_id,class_id,starts_on)
 values((select id from ctx where key='w1'),(select id from ctx where key='u1'),(select id from ctx where key='student2'),(select id from ctx where key='class1'),'2026-09-01')$q$,'23503','FK composita blocca riferimenti cross-workspace anche senza RLS');
select test_support.ok(public.propose_grade(0.8,1,10,0.1,'[[0,0],[1,1]]')=8.2,'Conversione lineare e arrotondamento');
select test_support.ok(public.propose_grade(0.5,0,100,1,'[[0,0],[0.5,0.7],[1,1]]')=70,'Conversione non lineare');
select test_support.throws_sqlstate($q$select public.propose_grade(0.5,1,10,1,'[[0,0],[0,1]]')$q$,'P0001','Curve non monotone rifiutate');

set local role anon;
select test_support.throws_sqlstate('select * from public.students','42501','Anonimo: accesso tabelle negato');
select test_support.throws_sqlstate('select * from public.v_grade_register','42501','Anonimo: accesso viste negato');
select test_support.throws_sqlstate($q$select public.sync_mutation(gen_random_uuid(),'students',gen_random_uuid(),gen_random_uuid(),0,'{}')$q$,'42501','Anonimo: RPC negata');
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select test_support.ok(not exists(select 1 from public.students where workspace_id=(select id from ctx where key='w2')),'Isolamento lettura workspace');
select test_support.ok((select count(*)=10 from public.students),'Owner vede i suoi studenti');
select test_support.ok((select count(*)=4 from public.v_grade_register),'Owner vede i suoi voti');
select test_support.throws_sqlstate($q$update public.workspace_members set role='admin' where user_id=auth.uid()$q$,'42501','Modifica diretta ruolo negata');
select test_support.throws_sqlstate($q$update public.workspaces set owner_id='22222222-2222-4222-8222-222222222222'$q$,'42501','Modifica proprietario workspace negata');
select test_support.throws_sqlstate($q$insert into public.students(workspace_id,created_by,external_code,first_name,last_name) values((select id from ctx where key='w1'),(select id from ctx where key='u2'),'spoof','Nome','Falso')$q$,'42501','Spoofing autore negato');
select test_support.throws_sqlstate($q$insert into public.students(workspace_id,external_code,first_name,last_name) values((select id from ctx where key='w2'),'cross','Nome','Falso')$q$,'42501','Inserimento altro workspace negato');
select test_support.throws_sqlstate($q$update public.students set workspace_id=(select id from ctx where key='w2'),version=version+1 where id=(select id from ctx where key='student1')$q$,'42501','Spostamento record tra workspace negato');
select test_support.throws_sqlstate($q$update public.students set created_by=(select id from ctx where key='u2'),version=version+1 where id=(select id from ctx where key='student1')$q$,'42501','Modifica autore negata');
select test_support.throws_sqlstate($q$insert into public.enrollments(workspace_id,student_id,class_id,starts_on) values((select id from ctx where key='w1'),(select id from ctx where key='student2'),(select id from ctx where key='class1'),'2026-09-01')$q$,'42501','Studente altro workspace respinto da RLS');
select test_support.throws_sqlstate($q$update public.students set first_name='stale' where id=(select id from ctx where key='student1')$q$,'40001','Scrittura diretta senza versione respinta');
select test_support.throws_sqlstate($q$delete from public.students$q$,'42501','Hard delete negato');
select test_support.ok((select count(*)=2 from public.lessons),'Lezioni coerenti nel seed');
select test_support.ok((select count(*)=2 from public.assignments),'Compiti coerenti nel seed');
select test_support.ok((select count(*)=2 from public.assessments),'Verifiche coerenti nel seed');
select test_support.ok((select bool_and(weighted_average=7.6) from public.v_student_averages),'Media canonica pesata corretta');
select test_support.ok((select count(*)=4 from public.v_grade_register where included_in_average),'Descrittive escluse dal registro');
update public.grade_entries set excluded_from_average=true,version=version+1 where id=(select id from ctx where key='grade1');
select test_support.ok((select not included_in_average from public.v_grade_register where id=(select id from ctx where key='grade1')),'Voti esclusi non conteggiati');
update public.grade_entries set status='cancelled',version=version+1 where id=(select id from ctx where key='gradeobs');
select test_support.ok((select not included_in_average from public.v_grade_register where id=(select id from ctx where key='gradeobs')),'Voti annullati non conteggiati');
select test_support.throws_sqlstate($q$update public.grade_entries set confirmed_value=6,version=version+1 where id=(select id from ctx where key='grade1')$q$,'23514','Modifica voto richiede motivazione');
update public.grade_entries set confirmed_value=6,change_reason='Rettifica fittizia',version=version+1 where id=(select id from ctx where key='grade1');
select test_support.ok((select count(*)>=3 from public.grade_audit_log where grade_entry_id=(select id from ctx where key='grade1')),'Audit append-only delle revisioni');
select test_support.throws_sqlstate('update public.grade_audit_log set operation=''fake''','42501','Audit non modificabile dal client');
select test_support.throws_sqlstate($q$insert into public.grade_entries(workspace_id,enrollment_id,teaching_assignment_id,class_id,category_id,rule_id,graded_on,origin,observation_id,confirmed_value,status)
 select o.workspace_id,o.enrollment_id,o.teaching_assignment_id,o.class_id,g.category_id,g.rule_id,current_date,'observation',o.id,7,'confirmed'
 from public.observations o cross join public.grade_entries g where o.id=(select id from ctx where key='descriptive') and g.id=(select id from ctx where key='grade1')$q$,'23514','Descrittive non possono ricevere voti');
select test_support.throws_sqlstate($q$update public.question_results set score=999,version=version+1 where workspace_id=(select id from ctx where key='w1')$q$,'23514','Punteggio oltre il massimo respinto');
select test_support.throws_sqlstate($q$update public.question_results set max_score_snapshot=999,version=version+1 where workspace_id=(select id from ctx where key='w1')$q$,'23514','Snapshot punteggi immutabile');
select test_support.ok((select bool_and(total_exercises=2 and correct=1 and partial=1 and not_done=0) from public.v_homework_summary),'Conteggi compiti derivati senza duplicazioni');

select public.sync_mutation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','students','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',(select id from ctx where key='w1'),0,'{"external_code":"SYNC-1","first_name":"Offline","last_name":"Fittizio"}');
select public.sync_mutation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','students','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',(select id from ctx where key='w1'),0,'{"external_code":"SYNC-1","first_name":"Offline","last_name":"Fittizio"}');
select test_support.ok((select count(*)=1 from public.students where external_code='SYNC-1'),'Ritrasmissione idempotente');
select test_support.throws_sqlstate($q$select public.sync_mutation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','students','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',(select id from ctx where key='w1'),0,'{}')$q$,'22023','Riuso operation_id con payload diverso negato');
select public.sync_mutation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab','students','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',(select id from ctx where key='w1'),1,'{"first_name":"Revisionato"}');
select test_support.throws_sqlstate($q$select public.sync_mutation(gen_random_uuid(),'students','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',(select id from ctx where key='w1'),1,'{"first_name":"Obsoleto"}')$q$,'40001','Conflitto offline rilevato');
select test_support.throws_sqlstate($q$select public.sync_mutation(gen_random_uuid(),'students','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',(select id from ctx where key='w1'),2,'{"created_by":"22222222-2222-4222-8222-222222222222"}')$q$,'42501','Sync non modifica autore');
select public.sync_mutation(gen_random_uuid(),'students','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',(select id from ctx where key='w1'),2,'{"deleted_at":"2026-10-21T12:00:00Z"}');
select test_support.ok((select deleted_at is not null and version=3 from public.students where external_code='SYNC-1'),'Tombstone leggibile per sincronizzazione');

select public.preview_import((select id from ctx where key='w1'),'students','[{"external_code":"IMPORT-1","first_name":"Importato","last_name":"Fittizio"},{"external_code":"IMPORT-1","first_name":"Duplicato","last_name":"Fittizio"}]');
select test_support.ok((select count(*)=1 from public.import_rows where validation_errors<>'[]'),'Anteprima identifica duplicati nel file');
update public.import_rows set resolution=case when validation_errors='[]' then 'insert' else 'skip' end,version=version+1;
select test_support.ok(public.apply_import((select id from public.import_batches limit 1),1)=1,'Import applica solo righe risolte e valide');
select test_support.ok((select count(*)=1 from public.students where external_code='IMPORT-1'),'Import non duplica studenti');

insert into public.topics(workspace_id,subject_id,name) select workspace_id,id,'Fisica fittizia' from public.subjects where workspace_id=(select id from ctx where key='w1') and code='FIS';

select test_support.throws_sqlstate($q$insert into public.grade_entries select (jsonb_populate_record(null::public.grade_entries,to_jsonb(g)||jsonb_build_object('id',gen_random_uuid()))).* from public.grade_entries g where id=(select id from ctx where key='grade1')$q$,'23505','Origine voto unica impedisce doppi conteggi');
select test_support.throws_sqlstate($q$select public.sync_mutation(gen_random_uuid(),'students','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',(select id from ctx where key='w1'),3,'{"not_a_column":"x"}')$q$,'42501','Sync rifiuta campi sconosciuti');
select test_support.ok(public.student_average((select id from ctx where key='w2'),(select id from ctx where key='student2'),(select id from public.subjects where code='MAT' limit 1),'2026-01-01','2027-12-31') is null,'RPC medie non espone workspace altrui');
select test_support.throws_sqlstate($q$insert into public.homework_checks(workspace_id,assignment_id,enrollment_id,class_id,checked_on)
 select a.workspace_id,a.id,e.id,a.class_id,current_date from public.assignments a join public.enrollments e on e.workspace_id=a.workspace_id and e.class_id<>a.class_id limit 1$q$,'23503','Controllo compiti rifiuta studenti di altra classe');
select test_support.throws_sqlstate($q$insert into public.question_results(workspace_id,assessment_result_id,assessment_id,question_id,score,max_score_snapshot)
 select r.workspace_id,r.id,r.assessment_id,q.id,1,10 from public.assessment_results r join public.assessment_questions q on q.workspace_id=r.workspace_id and q.assessment_id<>r.assessment_id limit 1$q$,'23503','Risultato quesito di altra verifica respinto');
select test_support.throws_sqlstate($q$insert into public.assignment_topics(workspace_id,assignment_id,topic_id)
 select a.workspace_id,a.id,t.id from public.assignments a join public.topics t on t.workspace_id=a.workspace_id join public.subjects s on s.workspace_id=a.workspace_id and s.code='FIS' where t.subject_id=s.id limit 1$q$,'23514','Argomento di materia diversa respinto');
insert into public.students(workspace_id,external_code,first_name,last_name,visibility) values((select id from ctx where key='w1'),'PRIVATE','Privato','Fittizio','private');
select public.set_workspace_member((select id from ctx where key='w1'),(select id from ctx where key='u2'),'viewer');
reset role;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
select test_support.ok(not exists(select 1 from public.students where external_code='PRIVATE'),'Viewer non vede dati riservati di altro docente');
select test_support.ok(exists(select 1 from public.students where workspace_id=(select id from ctx where key='w1')),'Viewer vede dati condivisi');
select test_support.throws_sqlstate($q$insert into public.students(workspace_id,external_code,first_name,last_name) values((select id from ctx where key='w1'),'VIEWER','Nome','Falso')$q$,'42501','Viewer non scrive');
select test_support.throws_sqlstate($q$select public.set_workspace_member((select id from ctx where key='w1'),auth.uid(),'admin')$q$,'42501','Viewer non si promuove');
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select public.set_workspace_member((select id from ctx where key='w1'),(select id from ctx where key='u2'),'teacher');
reset role;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
select test_support.throws_sqlstate($q$insert into public.lessons(workspace_id,teaching_assignment_id,starts_at,ends_at,title) values((select id from ctx where key='w1'),(select id from ctx where key='assignment1'),now(),now()+interval '1 hour','Non assegnato')$q$,'42501','Teacher non scrive lezioni non assegnate');
select test_support.throws_sqlstate($q$insert into public.teaching_assignments(workspace_id,class_subject_id,class_id,teacher_id) values((select id from ctx where key='w1'),(select id from ctx where key='classsubject1'),(select class_id from public.class_subjects where id=(select id from ctx where key='classsubject1')),auth.uid())$q$,'42501','Teacher non si autoassegna una classe');
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select public.set_workspace_member((select id from ctx where key='w1'),(select id from ctx where key='u2'),'admin');
reset role;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
select test_support.ok(not exists(select 1 from public.students where external_code='PRIVATE'),'Admin non vede note private altrui');
select test_support.throws_sqlstate($q$select public.set_workspace_member((select id from ctx where key='w1'),auth.uid(),'owner')$q$,'42501','Admin non assegna ruoli');
insert into public.students(workspace_id,external_code,first_name,last_name) values((select id from ctx where key='w1'),'ADMIN','Admin','Fittizio');
select test_support.ok(exists(select 1 from public.students where external_code='ADMIN'),'Admin può gestire anagrafiche condivise');

select test_support.throws_sqlstate($q$update public.ai_workspace_settings set enabled=true,version=version+1 where workspace_id=(select id from ctx where key='w1')$q$,'23514','AI non attivabile nella fase 1');
select test_support.throws_sqlstate($q$update public.students set visibility='private',version=version+1 where external_code='ADMIN'$q$,'42501','Visibilita del record immutabile');
select test_support.ok(not exists(select 1 from public.v_grade_register where workspace_id not in (select workspace_id from public.workspace_members where user_id=auth.uid())),'Viste rispettano appartenenza workspace');

select public.sync_mutation('cccccccc-cccc-4ccc-8ccc-cccccccccccc','students','dddddddd-dddd-4ddd-8ddd-dddddddddddd',(select id from ctx where key='w1'),0,'{"external_code":"ROLE-REVOKE","first_name":"Revoca","last_name":"Fittizio"}');
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select public.set_workspace_member((select id from ctx where key='w1'),(select id from ctx where key='u2'),'viewer');
reset role;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
select test_support.throws_sqlstate($q$select public.sync_mutation('cccccccc-cccc-4ccc-8ccc-cccccccccccc','students','dddddddd-dddd-4ddd-8ddd-dddddddddddd',(select id from ctx where key='w1'),0,'{"external_code":"ROLE-REVOKE","first_name":"Revoca","last_name":"Fittizio"}')$q$,'42501','Retry offline ricontrolla ruolo revocato');
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select public.remove_workspace_member((select id from ctx where key='w1'),(select id from ctx where key='u2'));
reset role;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
select test_support.ok(not exists(select 1 from public.students where workspace_id=(select id from ctx where key='w1')),'Revoca appartenenza rimuove accesso in lettura');
select test_support.ok(exists(select 1 from public.students where workspace_id=(select id from ctx where key='w2')),'Revoca non influenza workspace personale');
reset role;
select extensions.ok(passed,label) from test_support.results order by label;
select * from extensions.finish();
rollback;
