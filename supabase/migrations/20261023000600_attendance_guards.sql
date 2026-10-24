create function private.validate_attendance() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_TABLE_NAME='grade_entries' then
  if new.status='confirmed' and new.assessment_result_id is not null and exists(select 1 from public.assessment_results where workspace_id=new.workspace_id and id=new.assessment_result_id and attendance='absent') then raise exception 'Studente assente: nessuna pubblicazione del voto.' using errcode='23514';end if;
 else
  if new.attendance='absent' and exists(select 1 from public.grade_entries where workspace_id=new.workspace_id and assessment_result_id=new.id and status='confirmed' and deleted_at is null) then raise exception 'Prima rettifica o annulla esplicitamente il voto confermato.' using errcode='23514';end if;
 end if;return new;
end $$;
create trigger validate_attendance before insert or update on public.assessment_results for each row execute function private.validate_attendance();
create trigger validate_a_attendance before insert or update on public.grade_entries for each row execute function private.validate_attendance();
revoke all on function private.validate_attendance() from public,anon,authenticated;

-- A subsequent detailed homework correction supersedes an explicit daily summary.
-- This keeps the existing homework editor and the rapid register on the same source.
create function private.homework_detail_supersedes_daily() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 update public.homework_checks set daily_status=null,version=version+1
 where workspace_id=new.workspace_id and id=new.homework_check_id and daily_status is not null;
 return new;
end $$;
revoke all on function private.homework_detail_supersedes_daily() from public,anon,authenticated;
create trigger homework_detail_supersedes_daily after insert or update on public.homework_exercise_results for each row execute function private.homework_detail_supersedes_daily();
