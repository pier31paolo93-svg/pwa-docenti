create table private.sync_operations(
 actor_id uuid not null default auth.uid() references public.profiles(id),
 operation_id uuid not null, workspace_id uuid not null references public.workspaces(id),
 table_name text not null, record_id uuid not null, request_hash text not null,
 response jsonb not null, created_at timestamptz not null default now(),
 primary key(actor_id,operation_id)
);
alter table private.sync_operations enable row level security;
grant select,insert on private.sync_operations to authenticated;
create policy sync_select on private.sync_operations for select to authenticated using(actor_id=auth.uid() and private.member_role(workspace_id) is not null);
create policy sync_insert on private.sync_operations for insert to authenticated with check(actor_id=auth.uid() and private.member_role(workspace_id) in ('owner','admin','teacher'));
create function public.sync_mutation(p_operation uuid,p_table text,p_id uuid,p_workspace uuid,p_expected_version bigint,p_patch jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare previous private.sync_operations; current_row jsonb; result jsonb; cols text; vals text; assignments text; k text; request_hash text;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_table not in ('school_years','schools','subjects','classes','students','enrollments','class_subjects','teaching_assignments','topics','competencies','lessons','lesson_topics','lesson_activities','error_types','assignments','assignment_topics','assignment_exercises','homework_checks','homework_exercise_results','homework_errors','observation_types','observations','observation_errors','observation_competencies','observation_topics','assessment_rubrics','rubric_criteria','assessments','assessment_questions','assessment_results','question_results','question_errors','rubric_scores','evaluation_categories','evaluation_rules','grade_entries','ai_workspace_settings','ai_requests','import_batches','import_rows') or p_table is null or p_operation is null or p_id is null or p_workspace is null then raise exception 'Invalid sync target'; end if;
 if jsonb_typeof(p_patch)<>'object' or p_expected_version is null or p_expected_version<0 then raise exception 'Invalid sync request'; end if;
 if not coalesce(private.member_role(p_workspace) in ('owner','admin','teacher'),false) then raise exception 'Write membership required' using errcode='42501'; end if;
 request_hash:=md5(jsonb_build_array(p_table,p_id,p_workspace,p_expected_version,p_patch)::text);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation::text,0));
 select * into previous from private.sync_operations where actor_id=auth.uid() and operation_id=p_operation;
 if found then
  if previous.request_hash<>request_hash then raise exception 'Idempotency key reused with different payload' using errcode='22023'; end if;
  execute format('select to_jsonb(t) from public.%I t where id=$1 and workspace_id=$2',p_table) into current_row using p_id,p_workspace;
  if current_row is null or not private.allowed(p_table,current_row,true) then raise exception 'Resource access revoked' using errcode='42501'; end if;
  return previous.response;
 end if;
 for k in select jsonb_object_keys(p_patch) loop
  if k in ('id','workspace_id','created_by','created_at','updated_at','version','calculation_snapshot') or not exists(select 1 from information_schema.columns where table_schema='public' and table_name=p_table and column_name=k) then raise exception 'Forbidden or unknown field: %',k using errcode='42501'; end if;
 end loop;
 select string_agg(format('%I',key),','),string_agg(format('x.%I',key),','),string_agg(format('%I=x.%I',key,key),',')
 into cols,vals,assignments from jsonb_object_keys(p_patch) key;
 if p_expected_version=0 then
  execute format('insert into public.%I(id,workspace_id%s) select $1,$2%s from jsonb_populate_record(null::public.%I,$3) x returning to_jsonb(%I.*)',p_table,case when cols is null then '' else ','||cols end,case when vals is null then '' else ','||vals end,p_table,p_table)
  into result using p_id,p_workspace,p_patch;
 else
  execute format('select to_jsonb(t) from public.%I t where id=$1 and workspace_id=$2 for update',p_table) into current_row using p_id,p_workspace;
  if current_row is null then raise exception 'Record inaccessible' using errcode='42501'; end if;
  if (current_row->>'version')::bigint<>p_expected_version then raise exception 'Version conflict' using errcode='40001'; end if;
  execute format('update public.%I t set version=$4+1%s from jsonb_populate_record(null::public.%I,$3) x where t.id=$1 and t.workspace_id=$2 and t.version=$4 returning to_jsonb(t)',p_table,case when assignments is null then '' else ','||assignments end,p_table)
  into result using p_id,p_workspace,p_patch,p_expected_version;
  if result is null then raise exception 'Record not writable' using errcode='42501'; end if;
 end if;
 insert into private.sync_operations(actor_id,operation_id,workspace_id,table_name,record_id,request_hash,response)
 values(auth.uid(),p_operation,p_workspace,p_table,p_id,request_hash,result);
 return result;
end $$;
revoke all on function public.sync_mutation(uuid,text,uuid,uuid,bigint,jsonb) from public,anon;
grant execute on function public.sync_mutation(uuid,text,uuid,uuid,bigint,jsonb) to authenticated;

create function public.preview_import(p_workspace uuid,p_kind text,p_rows jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare batch uuid; item jsonb; errors jsonb; row_no integer:=0; duplicate uuid; seen text[]:='{}'; row_key text;
begin
 if p_kind not in ('students','enrollments') or p_kind is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>1000 then raise exception 'Invalid import (max 1000 rows)'; end if;
 insert into public.import_batches(workspace_id,kind) values(p_workspace,p_kind) returning id into batch;
 for item in select value from jsonb_array_elements(p_rows) loop
  row_no:=row_no+1; errors:='[]'; duplicate:=null;
  if jsonb_typeof(item)<>'object' then errors:='["object_required"]';
  elsif p_kind='students' then
   if nullif(btrim(item->>'external_code'),'') is null or nullif(btrim(item->>'first_name'),'') is null or nullif(btrim(item->>'last_name'),'') is null then errors:=errors||'["missing_required_fields"]'; end if;
   row_key:=item->>'external_code';
   select id into duplicate from public.students where workspace_id=p_workspace and external_code=row_key;
   if duplicate is not null or row_key=any(seen) then errors:=errors||'["duplicate_external_code"]'; end if;
   seen:=array_append(seen,row_key);
  else
   begin
    if not exists(select 1 from public.students where id=(item->>'student_id')::uuid and workspace_id=p_workspace and deleted_at is null) or
       not exists(select 1 from public.classes where id=(item->>'class_id')::uuid and workspace_id=p_workspace and deleted_at is null) or (item->>'starts_on')::date is null then errors:=errors||'["invalid_enrollment_references"]'; end if;
    if exists(select 1 from public.enrollments where student_id=(item->>'student_id')::uuid and class_id=(item->>'class_id')::uuid and workspace_id=p_workspace) then errors:=errors||'["duplicate_enrollment"]'; end if;
    row_key:=coalesce(item->>'student_id','')||':'||coalesce(item->>'class_id','');
    if row_key=any(seen) then errors:=errors||'["duplicate_in_batch"]'; end if;
    seen:=array_append(seen,row_key);
   exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then errors:=errors||'["invalid_uuid_or_date"]';
   end;
  end if;
  insert into public.import_rows(workspace_id,batch_id,row_number,payload,validation_errors,duplicate_of)
  values(p_workspace,batch,row_no,item,errors,duplicate);
 end loop;
 return batch;
end $$;
create function public.apply_import(p_batch uuid,p_expected_version bigint) returns integer
language plpgsql security invoker set search_path='' as $$
declare batch public.import_batches; item public.import_rows; inserted integer:=0;
begin
 select * into strict batch from public.import_batches where id=p_batch for update;
 if batch.version<>p_expected_version then raise exception 'Version conflict' using errcode='40001'; end if;
 if batch.status='applied' then return 0; end if;
 if batch.status<>'preview' then raise exception 'Import not in preview'; end if;
 for item in select * from public.import_rows where batch_id=p_batch and workspace_id=batch.workspace_id and deleted_at is null order by row_number for update loop
  if item.resolution not in ('insert','skip','reject') then raise exception 'Resolve every row before applying'; end if;
  if item.resolution='insert' then
   if item.validation_errors<>'[]'::jsonb then raise exception 'Invalid preview row'; end if;
   if batch.kind='students' then
    insert into public.students(workspace_id,external_code,first_name,last_name) values(batch.workspace_id,item.payload->>'external_code',item.payload->>'first_name',item.payload->>'last_name');
   else
    insert into public.enrollments(workspace_id,student_id,class_id,starts_on) values(batch.workspace_id,(item.payload->>'student_id')::uuid,(item.payload->>'class_id')::uuid,(item.payload->>'starts_on')::date);
   end if;
   inserted:=inserted+1;
  end if;
 end loop;
 update public.import_batches set status='applied',version=version+1 where id=p_batch;
 return inserted;
end $$;
revoke all on function public.preview_import(uuid,text,jsonb),public.apply_import(uuid,bigint) from public,anon;
grant execute on function public.preview_import(uuid,text,jsonb),public.apply_import(uuid,bigint) to authenticated;
