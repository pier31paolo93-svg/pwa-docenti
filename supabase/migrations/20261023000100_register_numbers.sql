-- V1.2: incremental, local validation first. Cloud deployment requires authorization.
alter table public.enrollments add column register_number integer;
alter table public.enrollments add constraint enrollments_register_positive check(register_number>0);
-- A class already belongs to exactly one school year. Retain numbers on closed enrollments.
create unique index enrollments_register_unique on public.enrollments(workspace_id,class_id,register_number) where deleted_at is null;
create function private.number_enrollment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.workspace_id::text||new.class_id::text,21));
 if TG_OP='UPDATE' and (new.student_id,new.class_id) is distinct from (old.student_id,old.class_id) then
  raise exception 'Iscrizione storica: chiudi questa iscrizione e creane una nuova per cambiare studente o classe.' using errcode='23514';
 end if;
 if new.register_number is null and new.deleted_at is null then
  select n into new.register_number from generate_series(1,(select count(*)::integer+1 from public.enrollments where workspace_id=new.workspace_id and class_id=new.class_id and deleted_at is null)) n
  where not exists(select 1 from public.enrollments e where e.workspace_id=new.workspace_id and e.class_id=new.class_id and e.deleted_at is null and e.register_number=n and e.id<>new.id) order by n limit 1;
 end if;
 if TG_OP='UPDATE' and (new.starts_on,new.ends_on) is distinct from (old.starts_on,old.ends_on) and exists(
  select 1 from (
   select o.observed_on d from public.observations o where o.enrollment_id=old.id and o.workspace_id=old.workspace_id and o.deleted_at is null
   union all select a.assessed_on from public.assessment_results r join public.assessments a on (a.workspace_id,a.id)=(r.workspace_id,r.assessment_id) where r.enrollment_id=old.id and r.workspace_id=old.workspace_id and r.deleted_at is null
   union all select checked_on from public.homework_checks where enrollment_id=old.id and workspace_id=old.workspace_id and deleted_at is null
  ) dates where d<new.starts_on or d>coalesce(new.ends_on,'infinity'::date)
 ) then raise exception 'Le date escluderebbero attività già registrate nello storico.' using errcode='23514'; end if;
 return new;
end $$;
create trigger number_enrollment before insert or update on public.enrollments for each row execute function private.number_enrollment();
revoke all on function private.number_enrollment() from public,anon,authenticated;
-- Deterministic initial assignment; never renumber a value already set.
do $$ declare e record; begin
 for e in select x.id from public.enrollments x join public.students s on (s.workspace_id,s.id)=(x.workspace_id,x.student_id)
 where x.register_number is null and x.deleted_at is null order by x.workspace_id,x.class_id,lower(s.last_name),lower(s.first_name),s.id,x.id loop
  update public.enrollments set register_number=null,version=version+1 where id=e.id and register_number is null;
 end loop;
end $$;
alter table public.enrollments drop constraint enrollments_outcome_check;
alter table public.enrollments add constraint enrollments_outcome_check check(outcome in ('promoted','repeating','transferred','withdrawn','graduated','pending'));
