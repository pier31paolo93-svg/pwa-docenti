-- PREPARED TEST, NOT AUTHORIZED FOR CLOUD EXECUTION BY THE MIGRATION APPROVAL.
-- Requires separate approval for remote fixture writes, even though rolled back.
-- No Auth user writes, passwords, new accounts or persistent fixture data.
-- Run the whole file in ONE session with ON_ERROR_STOP. Never extract COMMITs:
-- this file deliberately has no COMMIT and ends with ROLLBACK.
begin;
set local statement_timeout='30s';
do $$
declare original_role text:=current_user; owners jsonb; item jsonb; f jsonb;
 owner_id uuid; ws uuid; other_ws uuid; sy uuid; school uuid; subject uuid;
 cls uuid; cs uuid; ta uuid; student uuid; enrollment uuid; rule_id uuid;
 assignment_id uuid; exercise_id uuid; check_id uuid; assessment_id uuid;
 operation_id uuid; student_row jsonb; replay jsonb; changed jsonb;
 batch uuid; import_row record; prefix text; fixtures jsonb:='[]'; tested integer:=0;
before_users text; before_profiles text; before_workspaces text; before_members text;
begin
 if not has_table_privilege('authenticated','public.v_homework_completion','SELECT')
 or has_table_privilege('authenticated','public.v_homework_completion','INSERT,UPDATE,DELETE')
 or exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
           where c.oid='public.v_homework_completion'::regclass
           and a.grantee=(select oid from pg_roles where rolname='authenticated') and a.privilege_type<>'SELECT') then
  raise exception 'STOP: view ACL discrepancy unresolved. Do not run cloud writes.';
 end if;
 select md5(jsonb_agg(to_jsonb(u) order by id)::text) into before_users from auth.users u;
 select md5(jsonb_agg(to_jsonb(p) order by id)::text) into before_profiles from public.profiles p;
 select md5(jsonb_agg(to_jsonb(w) order by id)::text) into before_workspaces from public.workspaces w;
 select md5(jsonb_agg(to_jsonb(m) order by workspace_id,user_id)::text) into before_members from public.workspace_members m;
 select jsonb_agg(jsonb_build_object('owner',w.owner_id,'workspace',w.id) order by w.id) into owners
 from public.workspaces w join public.workspace_members m on m.workspace_id=w.id and m.user_id=w.owner_id
 where w.deleted_at is null and m.role='owner' and m.revoked_at is null;
 if jsonb_array_length(owners)<>2 then raise exception 'STOP: expected exactly two personal Owner workspaces'; end if;
 for item in select value from jsonb_array_elements(owners) loop
  owner_id:=(item->>'owner')::uuid;ws:=(item->>'workspace')::uuid;
  other_ws:=case when ws=(owners->0->>'workspace')::uuid then (owners->1->>'workspace')::uuid else (owners->0->>'workspace')::uuid end;
  prefix:='RELEASE18_'||replace(gen_random_uuid()::text,'-','');
  sy:=gen_random_uuid();school:=gen_random_uuid();subject:=gen_random_uuid();cls:=gen_random_uuid();
  cs:=gen_random_uuid();ta:=gen_random_uuid();student:=gen_random_uuid();enrollment:=gen_random_uuid();rule_id:=gen_random_uuid();
  assignment_id:=gen_random_uuid();exercise_id:=gen_random_uuid();check_id:=gen_random_uuid();assessment_id:=gen_random_uuid();operation_id:=gen_random_uuid();
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  execute 'set local role authenticated';
  if exists(select 1 from public.workspaces where id=other_ws) then raise exception 'FAIL: other workspace visible';end if;
  perform public.frontend_sync_mutation(gen_random_uuid(),'school_years',sy,ws,0,jsonb_build_object('label',prefix,'starts_on','2098-09-01','ends_on','2099-08-31'));
  perform public.frontend_sync_mutation(gen_random_uuid(),'schools',school,ws,0,jsonb_build_object('name','Istituto interamente fittizio','code',prefix));
  perform public.frontend_sync_mutation(gen_random_uuid(),'subjects',subject,ws,0,jsonb_build_object('name','Materia fittizia','code',prefix));
  perform public.frontend_sync_mutation(gen_random_uuid(),'classes',cls,ws,0,jsonb_build_object('name',prefix,'school_id',school,'school_year_id',sy));
  perform public.frontend_sync_mutation(gen_random_uuid(),'class_subjects',cs,ws,0,jsonb_build_object('class_id',cls,'subject_id',subject));
  perform public.frontend_sync_mutation(gen_random_uuid(),'teaching_assignments',ta,ws,0,jsonb_build_object('class_subject_id',cs,'class_id',cls,'teacher_id',owner_id));
  student_row:=public.frontend_sync_mutation(operation_id,'students',student,ws,0,jsonb_build_object('first_name','Studente fittizio','last_name','Solo collaudo','external_code',prefix));
  replay:=public.frontend_sync_mutation(operation_id,'students',student,ws,0,jsonb_build_object('first_name','Studente fittizio','last_name','Solo collaudo','external_code',prefix));
  if replay<>student_row or (select count(*) from public.students where id=student)<>1 then raise exception 'FAIL duplicate operation';end if;
  changed:=public.frontend_sync_mutation(gen_random_uuid(),'students',student,ws,(student_row->>'version')::bigint,'{"first_name":"Aggiornamento interamente fittizio"}');
  if (changed->>'version')::bigint<>(student_row->>'version')::bigint+1 then raise exception 'FAIL version increment';end if;
  begin
   perform public.frontend_sync_mutation(gen_random_uuid(),'students',student,ws,(student_row->>'version')::bigint,'{"first_name":"Must not overwrite"}');
   raise exception 'FAIL stale update accepted';
  exception when sqlstate 'PT409' then null;end;
  perform public.frontend_sync_mutation(gen_random_uuid(),'enrollments',enrollment,ws,0,jsonb_build_object('student_id',student,'class_id',cls,'starts_on','2098-09-01'));
  perform public.frontend_sync_mutation(gen_random_uuid(),'evaluation_rules',rule_id,ws,0,jsonb_build_object('name',prefix,'minimum',1,'maximum',10,'rounding_step',0.1,'conversion_points','[[0,0],[1,1]]'::jsonb));
  perform public.frontend_sync_mutation(gen_random_uuid(),'assignments',assignment_id,ws,0,jsonb_build_object('teaching_assignment_id',ta,'class_id',cls,'title',prefix,'assigned_on','2098-09-02','due_on','2098-09-03'));
  perform public.frontend_sync_mutation(gen_random_uuid(),'assignment_exercises',exercise_id,ws,0,jsonb_build_object('assignment_id',assignment_id,'position',1,'description','Esercizio fittizio'));
  perform public.frontend_sync_mutation(gen_random_uuid(),'homework_checks',check_id,ws,0,jsonb_build_object('assignment_id',assignment_id,'enrollment_id',enrollment,'class_id',cls,'checked_on','2098-09-03'));
  begin
   perform public.frontend_sync_mutation(gen_random_uuid(),'homework_checks',check_id,ws,1,'{"excused":true,"excuse_reason":" "}');
   raise exception 'FAIL blank justification accepted';
  exception when check_violation then null;end;
  perform public.frontend_sync_mutation(gen_random_uuid(),'homework_checks',check_id,ws,1,'{"excused":true,"excuse_reason":"Motivo interamente fittizio"}');
  if not exists(select 1 from public.v_homework_completion where id=check_id and completion_status='excused' and completed_percent is null) then raise exception 'FAIL justified view';end if;
  perform public.frontend_sync_mutation(gen_random_uuid(),'assessments',assessment_id,ws,0,jsonb_build_object('teaching_assignment_id',ta,'class_id',cls,'title',prefix,'assessed_on','2098-09-03','kind','written','correction_mode','quick','evaluation_rule_id',rule_id));
  batch:=public.preview_import(ws,'students',jsonb_build_array(jsonb_build_object('first_name','Importazione fittizia','last_name','Solo collaudo','external_code',prefix||'_IMPORT')));
  for import_row in select * from public.import_rows where batch_id=batch loop
   perform public.frontend_sync_mutation(gen_random_uuid(),'import_rows',import_row.id,ws,import_row.version,'{"resolution":"insert"}');
  end loop;
  if public.frontend_apply_import(batch,1)<>1 then raise exception 'FAIL import adapter insert';end if;
  begin
   perform public.frontend_apply_import(batch,1);
   raise exception 'FAIL stale import accepted';
  exception when sqlstate 'PT409' then null;end;
  begin
   perform public.frontend_sync_mutation(gen_random_uuid(),'students',gen_random_uuid(),other_ws,0,jsonb_build_object('first_name','Cross-workspace fictitious','last_name','Must fail','external_code',prefix));
   raise exception 'FAIL write to other workspace accepted';
  exception when insufficient_privilege then null;end;
  fixtures:=fixtures||jsonb_build_array(jsonb_build_object('owner',owner_id,'workspace',ws,'assessment',assessment_id,'rule',rule_id,'student',student));
  execute format('set local role %I',original_role);
  tested:=tested+1;
 end loop;
 for f in select value from jsonb_array_elements(fixtures) loop
  perform set_config('request.jwt.claim.sub',f->>'owner',true);
  execute 'set local role authenticated';
  for item in select value from jsonb_array_elements(fixtures) where value->>'workspace'<>f->>'workspace' loop
   if exists(select 1 from public.students where id=(item->>'student')::uuid) then raise exception 'FAIL other workspace student readable';end if;
   begin
    perform public.frontend_sync_mutation(gen_random_uuid(),'assessments',(f->>'assessment')::uuid,(f->>'workspace')::uuid,1,jsonb_build_object('evaluation_rule_id',item->>'rule'));
    raise exception 'FAIL other workspace rule accepted';
   exception when insufficient_privilege or foreign_key_violation then null;end;
  end loop;
  execute format('set local role %I',original_role);
 end loop;
 if before_users is distinct from (select md5(jsonb_agg(to_jsonb(u) order by id)::text) from auth.users u)
 or before_profiles is distinct from (select md5(jsonb_agg(to_jsonb(p) order by id)::text) from public.profiles p)
 or before_workspaces is distinct from (select md5(jsonb_agg(to_jsonb(w) order by id)::text) from public.workspaces w)
 or before_members is distinct from (select md5(jsonb_agg(to_jsonb(m) order by workspace_id,user_id)::text) from public.workspace_members m)
 then raise exception 'FAIL account/workspace data changed';end if;
 raise notice 'PASS two-workspace INSERT/UPDATE, idempotence, PT409, justification, default rule, import, RLS isolation; account/workspace hashes unchanged. Fixtures will be rolled back.';
end $$;
rollback;
