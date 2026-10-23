alter table public.observations add column daily_lesson_id uuid;
alter table public.observations add constraint observation_daily_lesson_fk foreign key(workspace_id,daily_lesson_id) references public.lessons(workspace_id,id);
create unique index observation_daily_student on public.observations(workspace_id,daily_lesson_id,enrollment_id) where daily_lesson_id is not null and deleted_at is null;
insert into private.access_links values('observations','daily_lesson_id','lessons');
create function private.validate_daily_observation() returns trigger language plpgsql set search_path='' as $$
begin
 if new.daily_lesson_id is not null and not exists(select 1 from public.lessons where workspace_id=new.workspace_id and id=new.daily_lesson_id and teaching_assignment_id=new.teaching_assignment_id and (starts_at at time zone 'Europe/Rome')::date=new.observed_on) then raise exception 'L’osservazione deve appartenere alla lezione e alla data selezionata.' using errcode='23514';end if;
 return new;
end $$;
create trigger validate_daily_observation before insert or update on public.observations for each row execute function private.validate_daily_observation();
revoke all on function private.validate_daily_observation() from public,anon,authenticated;
alter table public.import_batches add column source_fingerprint text;
alter table public.import_batches add column result_report jsonb;
create unique index import_source_once on public.import_batches(workspace_id,created_by,source_fingerprint) where source_fingerprint is not null;
create function public.preview_student_import(p_workspace uuid,p_plan jsonb) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare item jsonb; student public.students;enrollment public.enrollments;class public.classes;seen text[]:=array[]::text[];numbers text[]:=array[]::text[];k text;n integer:=0;
begin
 if not coalesce(private.member_role(p_workspace) in ('owner','admin'),false) then raise insufficient_privilege;end if;
 if jsonb_typeof(p_plan) is distinct from 'array' or jsonb_array_length(p_plan) not between 1 and 1000 then raise exception 'Importa da 1 a 1000 righe.';end if;
 for item in select value from jsonb_array_elements(p_plan) loop
  if item->>'action'='skip' then continue;end if;
  if coalesce(item->>'action','') not in ('insert','update') or nullif(btrim(item->>'first_name'),'') is null or nullif(btrim(item->>'last_name'),'') is null or nullif(btrim(item->>'external_code'),'') is null then raise exception 'Risolvi ogni riga e completa nome, cognome e codice tecnico.';end if;
  k:=item->>'external_code';if k=any(seen) then raise exception 'Codice duplicato nel file.' using errcode='23505';end if;seen:=array_append(seen,k);
  if item->>'action'='update' then
   select * into strict student from public.students where workspace_id=p_workspace and id=(item->>'student_id')::uuid and deleted_at is null;
   if student.version is distinct from (item->>'student_version')::bigint then raise exception 'Studente modificato dopo l’anteprima.' using errcode='PT409';end if;
   if exists(select 1 from public.students where workspace_id=p_workspace and external_code=k and id<>student.id) then raise exception 'Codice assegnato a un altro studente.' using errcode='23505';end if;
  elsif exists(select 1 from public.students where workspace_id=p_workspace and external_code=k) then raise exception 'Codice studente già presente: riconcilia la riga.' using errcode='23505';end if;
  if nullif(item->>'class_id','') is not null then
   select * into strict class from public.classes where workspace_id=p_workspace and id=(item->>'class_id')::uuid and deleted_at is null;
   if (item->>'starts_on')::date is null or (item->>'register_number')::integer is null or (item->>'register_number')::integer<=0 then raise exception 'Completa data e numero positivo per l’iscrizione.' using errcode='23514';end if;
   k:=class.id::text||':'||(item->>'register_number');if k=any(numbers) then raise exception 'Numero di registro duplicato nel file.' using errcode='23505';end if;numbers:=array_append(numbers,k);
   select * into enrollment from public.enrollments where workspace_id=p_workspace and class_id=class.id and student_id=(item->>'student_id')::uuid;
   if found and (enrollment.deleted_at is not null or enrollment.version is distinct from (item->>'enrollment_version')::bigint) then raise exception 'Iscrizione archiviata o modificata: aggiorna e riconcilia lo storico.' using errcode='PT409';end if;
   if exists(select 1 from public.enrollments where workspace_id=p_workspace and class_id=class.id and deleted_at is null and register_number=(item->>'register_number')::integer and student_id is distinct from (item->>'student_id')::uuid) then raise exception 'Numero di registro già occupato nella classe.' using errcode='23505';end if;
  end if;n:=n+1;
 end loop;return jsonb_build_object('valid',true,'selected',n,'skipped',jsonb_array_length(p_plan)-n);
end $$;
create function public.apply_student_import(p_workspace uuid,p_operation uuid,p_source text,p_plan jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare batch public.import_batches;item jsonb;chosen_student uuid;enr public.enrollments;row_no integer:=0;created integer:=0;updated integer:=0;enrolled integer:=0;report jsonb;
begin
 if not coalesce(private.member_role(p_workspace) in ('owner','admin'),false) then raise insufficient_privilege;end if;
 if p_operation is null or p_source is null or p_source!~'^[0-9a-f]{64}$' then raise exception 'Identità del file non valida.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_workspace::text,25));
 select * into batch from public.import_batches where workspace_id=p_workspace and created_by=auth.uid() and source_fingerprint=p_source for update;
 if found then return batch.result_report||jsonb_build_object('already_applied',true);end if;
 perform public.preview_student_import(p_workspace,p_plan);
 insert into public.import_batches(id,workspace_id,kind,source_fingerprint) values(p_operation,p_workspace,'students',p_source);
 for item in select value from jsonb_array_elements(p_plan) loop
  row_no:=row_no+1;
  insert into public.import_rows(workspace_id,batch_id,row_number,payload,resolution) values(p_workspace,p_operation,row_no,item,case when item->>'action'='skip' then 'skip' else 'insert' end);
  if item->>'action'='skip' then continue;end if;
  if item->>'action'='insert' then
   insert into public.students(workspace_id,external_code,first_name,last_name) values(p_workspace,item->>'external_code',btrim(item->>'first_name'),btrim(item->>'last_name')) returning id into chosen_student;created:=created+1;
  else
   chosen_student:=(item->>'student_id')::uuid;
   update public.students set external_code=item->>'external_code',first_name=btrim(item->>'first_name'),last_name=btrim(item->>'last_name'),version=version+1 where workspace_id=p_workspace and id=chosen_student and version=(item->>'student_version')::bigint;
   if not found then raise exception 'Studente non più aggiornabile.' using errcode='PT409';end if;updated:=updated+1;
  end if;
  if nullif(item->>'class_id','') is not null then
   select * into enr from public.enrollments e where e.workspace_id=p_workspace and e.class_id=(item->>'class_id')::uuid and e.student_id=chosen_student for update;
   if found then update public.enrollments set register_number=(item->>'register_number')::integer,version=version+1 where workspace_id=p_workspace and id=enr.id and version=(item->>'enrollment_version')::bigint;if not found then raise exception 'Iscrizione cambiata.' using errcode='PT409';end if;
   else insert into public.enrollments(workspace_id,student_id,class_id,starts_on,register_number) values(p_workspace,chosen_student,(item->>'class_id')::uuid,(item->>'starts_on')::date,(item->>'register_number')::integer);end if;enrolled:=enrolled+1;
  end if;
 end loop;
 report:=jsonb_build_object('batch',p_operation,'created',created,'updated',updated,'enrollments',enrolled,'skipped',row_no-created-updated);
 update public.import_batches set status='applied',result_report=report,version=version+1 where workspace_id=p_workspace and id=p_operation;return report;
exception when serialization_failure then raise sqlstate 'PT409' using message='Dati modificati: aggiorna l’anteprima.';
end $$;
revoke all on function public.preview_student_import(uuid,jsonb),public.apply_student_import(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.preview_student_import(uuid,jsonb),public.apply_student_import(uuid,uuid,text,jsonb) to authenticated;
