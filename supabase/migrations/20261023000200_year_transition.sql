-- Online-only, atomic and idempotent year transition. No seed or historical deletion.
create table public.year_transitions(
 id uuid primary key,workspace_id uuid not null references public.workspaces(id),created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(),status text not null check(status='applied'),request_hash text not null,payload jsonb not null,result jsonb not null
);
alter table public.year_transitions enable row level security;
revoke all on public.year_transitions from public,anon,authenticated;
grant select on public.year_transitions to authenticated;
create policy year_transitions_read on public.year_transitions for select to authenticated using(created_by=auth.uid() and private.member_role(workspace_id) in ('owner','admin'));
create index year_transitions_actor_workspace on public.year_transitions(workspace_id,created_by,created_at);

create function private.year_transition_plan(w uuid,p jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare sy public.school_years; ty public.school_years; school public.schools; e public.enrollments; c public.classes; dst public.classes;
 item jsonb; entry jsonb; d jsonb; a jsonb; cs public.class_subjects; seen uuid[]:=array[]::uuid[]; expected_count integer; close_on date;
begin
 if not coalesce(private.member_role(w) in ('owner','admin'),false) then raise exception 'Passaggio anno riservato a Owner/Admin del workspace.' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' or jsonb_typeof(p->'students') is distinct from 'array' or jsonb_typeof(p->'classes') is distinct from 'array' or jsonb_array_length(p->'students')>2000 then raise exception 'Piano passaggio anno non valido (massimo 2000 iscrizioni).'; end if;
 select * into strict sy from public.school_years where workspace_id=w and id=(p->>'source_year_id')::uuid and deleted_at is null;
 select * into strict school from public.schools where workspace_id=w and id=(p->>'school_id')::uuid and deleted_at is null;
 if not private.allowed('school_years',to_jsonb(sy),true) or not private.allowed('schools',to_jsonb(school),true) then raise insufficient_privilege; end if;
 if (p->>'source_year_id')=(p->'target_year'->>'id') then raise exception 'Origine e destinazione devono essere anni diversi.'; end if;
 select * into ty from public.school_years where workspace_id=w and id=(p->'target_year'->>'id')::uuid and deleted_at is null;
 if found then
  if not private.allowed('school_years',to_jsonb(ty),true) then raise insufficient_privilege; end if;
 else
  if exists(select 1 from public.school_years where id=(p->'target_year'->>'id')::uuid) then raise insufficient_privilege;end if;
  if nullif(btrim(p->'target_year'->>'label'),'') is null or (p->'target_year'->>'starts_on')::date is null or (p->'target_year'->>'ends_on')::date is null then raise exception 'Completa il nuovo anno scolastico.'; end if;
  ty.id:=(p->'target_year'->>'id')::uuid;ty.starts_on:=(p->'target_year'->>'starts_on')::date;ty.ends_on:=(p->'target_year'->>'ends_on')::date;
  if exists(select 1 from public.school_years where workspace_id=w and label=p->'target_year'->>'label') then raise exception 'La denominazione del nuovo anno è già presente.'; end if;
 end if;
 if ty.id is null or ty.starts_on<=sy.ends_on or ty.ends_on<=ty.starts_on then raise exception 'L’anno di destinazione deve essere successivo e avere date valide.'; end if;
 close_on:=(p->>'close_on')::date;
 if close_on is null or close_on<sy.starts_on or close_on>sy.ends_on then raise exception 'Data di chiusura non valida per l’anno di origine.'; end if;
 if jsonb_typeof(p->'source_classes') is distinct from 'array' or jsonb_array_length(p->'source_classes')=0 then raise exception 'Seleziona almeno una classe di origine.'; end if;
 for item in select value from jsonb_array_elements(p->'source_classes') loop
  select * into strict c from public.classes where workspace_id=w and id=(item#>>'{}')::uuid and school_id=school.id and school_year_id=sy.id and deleted_at is null;
  if not private.allowed('classes',to_jsonb(c),true) then raise insufficient_privilege; end if;
 end loop;
 for d in select value from jsonb_array_elements(p->'classes') loop
  if nullif(btrim(d->>'name'),'') is null or (d->>'id')::uuid is null then raise exception 'Completa il nome della classe di destinazione.'; end if;
  select * into dst from public.classes where id=(d->>'id')::uuid;
  if found and (dst.workspace_id<>w or dst.school_id<>school.id or dst.school_year_id<>ty.id or dst.deleted_at is not null or not private.allowed('classes',to_jsonb(dst),true)) then raise exception 'Classe di destinazione non autorizzata.' using errcode='42501'; end if;
  if found and dst.name is distinct from d->>'name' then raise exception 'Nome classe cambiato: aggiorna la destinazione.' using errcode='40001'; end if;
  if not found and exists(select 1 from public.classes where workspace_id=w and school_id=school.id and school_year_id=ty.id and name=d->>'name') then raise exception 'Nome classe già esistente: seleziona la classe censita.'; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p->'classes') x group by x->>'id' having count(*)>1) or exists(select 1 from jsonb_array_elements(p->'classes') x group by lower(btrim(x->>'name')) having count(*)>1) then raise exception 'Classi di destinazione duplicate.'; end if;
 for item in select value from jsonb_array_elements(p->'students') loop
  select * into strict e from public.enrollments where workspace_id=w and id=(item->>'enrollment_id')::uuid and deleted_at is null;
  if e.ends_on is not null or not exists(select 1 from jsonb_array_elements_text(p->'source_classes') v where v=e.class_id::text) or not private.allowed('enrollments',to_jsonb(e),true) then raise exception 'Iscrizione di origine non disponibile.' using errcode='42501'; end if;
  if e.id=any(seen) then raise exception 'Iscrizione ripetuta nel piano.'; end if; seen:=array_append(seen,e.id);
  if e.version is distinct from (item->>'version')::bigint then raise exception 'I dati di origine sono cambiati: rigenera l’anteprima.' using errcode='40001'; end if;
  if close_on<e.starts_on then raise exception 'La chiusura precede l’iscrizione.'; end if;
  if coalesce(item->>'outcome','') not in ('promoted','repeating','transferred','withdrawn','graduated','pending') then raise exception 'Scegli un esito per ogni studente.'; end if;
  if item->>'outcome' in ('promoted','repeating') then
   select value into d from jsonb_array_elements(p->'classes') where value->>'id'=item->>'destination_id';
   if d is null then raise exception 'Manca la classe di destinazione.'; end if;
   if coalesce((item->>'register_number')::integer,0)<=0 then raise exception 'Numero di registro positivo obbligatorio.'; end if;
   if exists(select 1 from public.enrollments where workspace_id=w and class_id=(d->>'id')::uuid and (student_id=e.student_id or (deleted_at is null and register_number=(item->>'register_number')::integer))) then raise exception 'Studente o numero già presente nella destinazione; ripristina l’iscrizione storica se archiviata.'; end if;
  elsif nullif(item->>'destination_id','') is not null then raise exception 'Trasferiti, ritirati, diplomati e sospesi non ricevono una nuova iscrizione.'; end if;
 end loop;
 select count(*) into expected_count from public.enrollments where workspace_id=w and deleted_at is null and ends_on is null and class_id::text in (select jsonb_array_elements_text(p->'source_classes'));
 if expected_count<>cardinality(seen) then raise exception 'Il piano deve includere tutti gli studenti delle classi selezionate, anche quelli da definire.'; end if;
 if exists(select 1 from jsonb_array_elements(p->'students') x where x->>'outcome' in ('promoted','repeating') group by x->>'destination_id',x->>'register_number' having count(*)>1) then raise exception 'Numeri di registro duplicati nella destinazione.'; end if;
 if exists(select 1 from jsonb_array_elements(p->'students') x join public.enrollments enrolled_row on enrolled_row.id=(x->>'enrollment_id')::uuid and enrolled_row.workspace_id=w where x->>'outcome' in ('promoted','repeating') group by x->>'destination_id',enrolled_row.student_id having count(*)>1) then raise exception 'Lo stesso studente compare due volte nella destinazione.'; end if;
 for entry in select value from jsonb_array_elements(coalesce(p->'copies','[]')) loop
  select * into strict cs from public.class_subjects where id=(entry->>'source_id')::uuid and workspace_id=w and deleted_at is null;
  if not private.allowed('class_subjects',to_jsonb(cs),false) or not exists(select 1 from jsonb_array_elements_text(p->'source_classes') v where v=cs.class_id::text) or not exists(select 1 from jsonb_array_elements(p->'classes') destination where destination->>'id'=entry->>'destination_id') then raise insufficient_privilege; end if;
  for a in select value from jsonb_array_elements(coalesce(entry->'teachers','[]')) loop
   if coalesce((a->>'confirmed')::boolean,false) is not true or not exists(select 1 from public.workspace_members where workspace_id=w and user_id=(a->>'id')::uuid and revoked_at is null and role in ('owner','admin','teacher')) then raise exception 'Ogni docente deve essere confermato esplicitamente e autorizzato.'; end if;
  end loop;
 end loop;
 return jsonb_build_object('valid',true,'plan',p,'counts',jsonb_build_object('students',cardinality(seen),'new_enrollments',(select count(*) from jsonb_array_elements(p->'students') x where x->>'outcome' in ('promoted','repeating')),'pending',(select count(*) from jsonb_array_elements(p->'students') x where x->>'outcome'='pending'),'subjects',jsonb_array_length(coalesce(p->'copies','[]'))));
end $$;
revoke all on function private.year_transition_plan(uuid,jsonb) from public,anon,authenticated;
create function public.preview_year_transition(p_workspace uuid,p_plan jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin return private.year_transition_plan(p_workspace,p_plan);
exception when serialization_failure then raise sqlstate 'PT409' using message='I dati sono cambiati: rigenera l’anteprima.';
end $$;
create function public.apply_year_transition(p_workspace uuid,p_operation uuid,p_plan jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.year_transitions; item jsonb; copy jsonb; teacher jsonb; e public.enrollments; subject uuid; dest_class_id uuid; created uuid; result jsonb; enrolled integer:=0; request text;
begin
 if not coalesce(private.member_role(p_workspace) in ('owner','admin'),false) then raise insufficient_privilege; end if;
 if p_operation is null then raise exception 'Identificativo operazione richiesto.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_workspace::text,22));
 perform 1 from public.workspaces where id=p_workspace for update;
 perform 1 from public.school_years where workspace_id=p_workspace and id in ((p_plan->>'source_year_id')::uuid,(p_plan->'target_year'->>'id')::uuid) order by id for update;
 perform 1 from public.classes where workspace_id=p_workspace and (id::text in (select jsonb_array_elements_text(p_plan->'source_classes')) or id::text in (select value->>'id' from jsonb_array_elements(p_plan->'classes'))) order by id for update;
 request:=md5(p_plan::text);
 select * into previous from public.year_transitions where id=p_operation;
 if found then
  if previous.workspace_id<>p_workspace or previous.created_by<>auth.uid() or previous.request_hash<>request then raise exception 'Identificativo operazione già usato per un piano diverso.' using errcode='22023'; end if;
  return previous.result;
 end if;
 -- Revalidate under lock, not just when the preview was displayed.
 perform 1 from public.enrollments where workspace_id=p_workspace and id::text in (select value->>'enrollment_id' from jsonb_array_elements(p_plan->'students')) order by id for update;
 perform private.year_transition_plan(p_workspace,p_plan);
 if not exists(select 1 from public.school_years where workspace_id=p_workspace and id=(p_plan->'target_year'->>'id')::uuid) then
  insert into public.school_years(id,workspace_id,created_by,label,starts_on,ends_on) values((p_plan->'target_year'->>'id')::uuid,p_workspace,auth.uid(),p_plan->'target_year'->>'label',(p_plan->'target_year'->>'starts_on')::date,(p_plan->'target_year'->>'ends_on')::date);
 end if;
 for item in select value from jsonb_array_elements(p_plan->'classes') loop
  if not exists(select 1 from public.classes where workspace_id=p_workspace and id=(item->>'id')::uuid) then
   insert into public.classes(id,workspace_id,created_by,school_id,school_year_id,name) values((item->>'id')::uuid,p_workspace,auth.uid(),(p_plan->>'school_id')::uuid,(p_plan->'target_year'->>'id')::uuid,item->>'name');
  end if;
 end loop;
 for item in select value from jsonb_array_elements(p_plan->'students') loop
  select * into strict e from public.enrollments where id=(item->>'enrollment_id')::uuid and workspace_id=p_workspace;
  if item->>'outcome'<>'pending' then
   update public.enrollments set ends_on=(p_plan->>'close_on')::date,outcome=item->>'outcome',version=version+1 where id=e.id and workspace_id=p_workspace;
   if item->>'outcome' in ('promoted','repeating') then
    insert into public.enrollments(workspace_id,created_by,student_id,class_id,starts_on,register_number)
    select p_workspace,auth.uid(),e.student_id,(item->>'destination_id')::uuid,y.starts_on,(item->>'register_number')::integer from public.school_years y where y.id=(p_plan->'target_year'->>'id')::uuid and y.workspace_id=p_workspace;
    enrolled:=enrolled+1;
   end if;
  end if;
 end loop;
 for copy in select value from jsonb_array_elements(coalesce(p_plan->'copies','[]')) loop
  select subject_id into strict subject from public.class_subjects where id=(copy->>'source_id')::uuid and workspace_id=p_workspace;
  dest_class_id:=(copy->>'destination_id')::uuid;
  select id into created from public.class_subjects c where c.workspace_id=p_workspace and c.class_id=dest_class_id and c.subject_id=subject and c.deleted_at is null;
  if created is null then insert into public.class_subjects(workspace_id,created_by,class_id,subject_id) values(p_workspace,auth.uid(),dest_class_id,subject) returning id into created; end if;
  for teacher in select value from jsonb_array_elements(coalesce(copy->'teachers','[]')) loop
   if not exists(select 1 from public.teaching_assignments a where a.workspace_id=p_workspace and a.class_subject_id=created and a.teacher_id=(teacher->>'id')::uuid and a.deleted_at is null) then
    insert into public.teaching_assignments(workspace_id,created_by,class_subject_id,class_id,teacher_id) values(p_workspace,auth.uid(),created,dest_class_id,(teacher->>'id')::uuid);
   end if;
  end loop;
 end loop;
 result:=jsonb_build_object('operation',p_operation,'status','applied','new_enrollments',enrolled,'target_year_id',p_plan->'target_year'->>'id');
 insert into public.year_transitions(id,workspace_id,created_by,status,request_hash,payload,result) values(p_operation,p_workspace,auth.uid(),'applied',request,p_plan,result);
 return result;
exception when serialization_failure then raise sqlstate 'PT409' using message='I dati sono cambiati: rigenera l’anteprima.';
end $$;
revoke all on function public.preview_year_transition(uuid,jsonb),public.apply_year_transition(uuid,uuid,jsonb) from public,anon;
grant execute on function public.preview_year_transition(uuid,jsonb),public.apply_year_transition(uuid,uuid,jsonb) to authenticated;
