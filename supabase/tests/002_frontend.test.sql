begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(12);
select extensions.has_column('public','homework_checks','excused','Giustificazioni strutturate');
select extensions.has_column('public','homework_checks','excuse_reason','Motivo della giustificazione');
select extensions.has_column('public','assessments','evaluation_rule_id','Regola predefinita della prova');
select extensions.has_view('public','v_homework_completion','Riepilogo completamento');
select extensions.ok((select 'security_invoker=true'=any(reloptions) from pg_class where oid='public.v_homework_completion'::regclass),'Vista security_invoker');
select extensions.ok(not has_table_privilege('anon','public.v_homework_completion','SELECT'),'Vista non accessibile agli anonimi');
select extensions.ok(exists(select 1 from pg_constraint where conrelid='public.homework_checks'::regclass and conname='homework_excuse_reason'),'Giustificazione richiede un motivo');
select extensions.ok(exists(select 1 from pg_constraint where conrelid='public.assessments'::regclass and conname='assessments_default_rule_fk' and pg_get_constraintdef(oid) like '%workspace_id%'),'Regola vincolata al workspace');
select extensions.ok(not has_function_privilege('anon','public.frontend_sync_mutation(uuid,text,uuid,uuid,bigint,jsonb)','EXECUTE') and not has_function_privilege('anon','public.frontend_apply_import(uuid,bigint)','EXECUTE'),'Adapter HTTP non eseguibili da anonimo');
select extensions.ok(not (select prosecdef from pg_proc where oid='public.frontend_sync_mutation(uuid,text,uuid,uuid,bigint,jsonb)'::regprocedure),'Adapter conserva security invoker');
do $$begin perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);end$$;
select extensions.throws_ok($test$
 select public.frontend_sync_mutation(gen_random_uuid(),'students',
 (select s.id from public.students s join public.workspaces w on w.id=s.workspace_id where w.owner_id='11111111-1111-4111-8111-111111111111' limit 1),
 (select id from public.workspaces where owner_id='11111111-1111-4111-8111-111111111111'),999999,'{"first_name":"Never applied"}'::jsonb)
$test$,'PT409','Version conflict','Conflitto sync convertito in HTTP 409 senza retry PostgREST');
create temporary table frontend_test_batch as select public.preview_import((select id from public.workspaces where owner_id='11111111-1111-4111-8111-111111111111'),'students','[]'::jsonb) as id;
select extensions.throws_ok($test$select public.frontend_apply_import((select id from frontend_test_batch),999999)$test$,'PT409','Version conflict','Conflitto import convertito in HTTP 409');
select * from extensions.finish();
rollback;
