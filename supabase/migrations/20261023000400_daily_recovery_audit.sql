-- V1.3/V1.4: local validation only; cloud deployment requires explicit authorization.
alter table public.homework_checks add column daily_status text check(daily_status in ('complete','partial','not_done','unchecked'));
alter table public.assessment_results add column attendance text not null default 'present' check(attendance in ('present','absent'));
create or replace view public.v_homework_completion with(security_invoker=true) as
select h.workspace_id,h.id,h.enrollment_id,h.assignment_id,h.excused,h.excuse_reason,
 case when h.excused then 'excused' when h.daily_status is not null then h.daily_status when s.total_exercises is null then 'unchecked' when s.not_done=0 then 'complete' when s.not_done=s.total_exercises then 'not_done' else 'partial' end completion_status,
 case when h.excused or h.daily_status in ('partial','unchecked') then null when h.daily_status='complete' then 100::numeric when h.daily_status='not_done' then 0::numeric else s.completed_percent end completed_percent
from public.homework_checks h left join public.v_homework_summary s on s.workspace_id=h.workspace_id and s.homework_check_id=h.id where h.deleted_at is null;

create table public.recovery_activities(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),created_by uuid not null default auth.uid() references public.profiles(id),visibility text not null default 'workspace' check(visibility in ('private','workspace')),version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,
 teaching_assignment_id uuid not null,class_id uuid not null,topic_id uuid,assessment_id uuid,title text not null check(length(btrim(title))>0),objective text not null check(length(btrim(objective))>0),due_on date,status text not null default 'planned' check(status in ('planned','in_progress','completed')),
 unique(workspace_id,id),unique(workspace_id,id,class_id),foreign key(workspace_id,teaching_assignment_id,class_id) references public.teaching_assignments(workspace_id,id,class_id),foreign key(workspace_id,topic_id) references public.topics(workspace_id,id),foreign key(workspace_id,assessment_id) references public.assessments(workspace_id,id)
);
create table public.recovery_students(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),created_by uuid not null default auth.uid() references public.profiles(id),visibility text not null default 'workspace' check(visibility in ('private','workspace')),version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,
 activity_id uuid not null,class_id uuid not null,enrollment_id uuid not null,status text not null default 'planned' check(status in ('planned','in_progress','completed')),outcome text,
 unique(workspace_id,id),unique(workspace_id,activity_id,enrollment_id),foreign key(workspace_id,activity_id,class_id) references public.recovery_activities(workspace_id,id,class_id),foreign key(workspace_id,enrollment_id,class_id) references public.enrollments(workspace_id,id,class_id)
);
insert into private.access_links values('recovery_activities','teaching_assignment_id','teaching_assignments'),('recovery_activities','topic_id','topics'),('recovery_activities','assessment_id','assessments'),('recovery_students','activity_id','recovery_activities'),('recovery_students','enrollment_id','enrollments');
do $$ declare t text;begin foreach t in array array['recovery_activities','recovery_students'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update on public.%I to authenticated',t);
 execute format('create policy read_record on public.%I for select to authenticated using(private.allowed(%L,to_jsonb(%I),false))',t,t,t);
 execute format('create policy insert_record on public.%I for insert to authenticated with check(created_by=auth.uid() and private.allowed(%L,to_jsonb(%I),true))',t,t,t);
 execute format('create policy update_record on public.%I for update to authenticated using(private.allowed(%L,to_jsonb(%I),true)) with check(private.allowed(%L,to_jsonb(%I),true))',t,t,t,t,t);
 execute format('create trigger stamp_record before insert or update on public.%I for each row execute function private.stamp_record()',t);
 execute format('create trigger protect_references before update on public.%I for each row execute function private.protect_references()',t);
 execute format('create index %I on public.%I(workspace_id,class_id,updated_at)',t||'_workspace_class',t);
 end loop;end $$;
create index recovery_activity_assignment on public.recovery_activities(workspace_id,teaching_assignment_id);
create index recovery_activity_topic on public.recovery_activities(workspace_id,topic_id);
create index recovery_activity_assessment on public.recovery_activities(workspace_id,assessment_id);
create index recovery_student_activity on public.recovery_students(workspace_id,activity_id,class_id);
create index recovery_student_enrollment on public.recovery_students(workspace_id,enrollment_id,class_id);
create function private.validate_recovery() returns trigger language plpgsql set search_path='' as $$
begin
 if new.topic_id is not null and not exists(select 1 from public.topics topic join public.teaching_assignments ta on ta.workspace_id=topic.workspace_id join public.class_subjects cs on (cs.workspace_id,cs.id)=(ta.workspace_id,ta.class_subject_id) where topic.id=new.topic_id and topic.workspace_id=new.workspace_id and ta.id=new.teaching_assignment_id and cs.subject_id=topic.subject_id) then raise exception 'Argomento non coerente con la materia.' using errcode='23514';end if;
 if new.assessment_id is not null and not exists(select 1 from public.assessments where workspace_id=new.workspace_id and id=new.assessment_id and teaching_assignment_id=new.teaching_assignment_id) then raise exception 'Verifica non coerente con il recupero.' using errcode='23514';end if;
 return new;
end $$;
create trigger validate_recovery before insert or update on public.recovery_activities for each row execute function private.validate_recovery();
revoke all on function private.validate_recovery() from public,anon,authenticated;
-- Extend the existing canonical, versioned/idempotent mutation entry point.
do $$ declare definition text;begin
 definition:=pg_get_functiondef('public.sync_mutation(uuid,text,uuid,uuid,bigint,jsonb)'::regprocedure);
 if position('''school_years'',''schools''' in definition)=0 then raise exception 'Unexpected sync contract';end if;
 execute replace(definition,'''school_years'',''schools''','''recovery_activities'',''recovery_students'',''school_years'',''schools''');
end $$;

create table public.record_audit_log(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),actor_id uuid references public.profiles(id),table_name text not null check(table_name in ('students','enrollments')),record_id uuid not null,operation text not null,old_record jsonb,new_record jsonb not null,created_at timestamptz not null default clock_timestamp()
);
alter table public.record_audit_log enable row level security;
revoke all on public.record_audit_log from public,anon,authenticated;
grant select on public.record_audit_log to authenticated;
create policy audit_read on public.record_audit_log for select to authenticated using(private.allowed(table_name,new_record,false) and (case when table_name='students' then exists(select 1 from public.students where id=record_id and workspace_id=record_audit_log.workspace_id) else exists(select 1 from public.enrollments where id=record_id and workspace_id=record_audit_log.workspace_id) end));
create index record_audit_lookup on public.record_audit_log(workspace_id,table_name,record_id,created_at);
create function private.audit_record() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.record_audit_log(workspace_id,actor_id,table_name,record_id,operation,old_record,new_record) values(new.workspace_id,auth.uid(),TG_TABLE_NAME,new.id,TG_OP,case when TG_OP='UPDATE' then to_jsonb(old) end,to_jsonb(new));return new;end $$;
revoke all on function private.audit_record() from public,anon,authenticated;
create trigger audit_record after insert or update on public.students for each row execute function private.audit_record();
create trigger audit_record after insert or update on public.enrollments for each row execute function private.audit_record();
create function public.undo_record_change(p_audit uuid,p_version bigint,p_operation uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare event public.record_audit_log; patch jsonb;current_row jsonb;
begin
 select * into strict event from public.record_audit_log where id=p_audit;
 if event.operation<>'UPDATE' or event.old_record is null then raise exception 'Inserimento non annullabile automaticamente: usa una procedura controllata.' using errcode='23514';end if;
 patch:=event.old_record-array['id','workspace_id','created_by','visibility','version','created_at','updated_at'];
 -- Delegate retry validation, payload identity and current permissions to the canonical RPC.
 if exists(select 1 from private.sync_operations where actor_id=auth.uid() and operation_id=p_operation) then
  return public.frontend_sync_mutation(p_operation,event.table_name,event.record_id,event.workspace_id,p_version,patch);
 end if;
 execute format('select to_jsonb(t) from public.%I t where workspace_id=$1 and id=$2 for update',event.table_name) into current_row using event.workspace_id,event.record_id;
 if current_row->>'version' is distinct from event.new_record->>'version' or p_version is distinct from (current_row->>'version')::bigint then raise exception 'Il record è cambiato dopo questa operazione.' using errcode='PT409';end if;
 patch:=event.old_record-array['id','workspace_id','created_by','visibility','version','created_at','updated_at'];
 return public.frontend_sync_mutation(p_operation,event.table_name,event.record_id,event.workspace_id,p_version,patch);
end $$;
revoke all on function public.undo_record_change(uuid,bigint,uuid) from public,anon;
grant execute on function public.undo_record_change(uuid,bigint,uuid) to authenticated;
