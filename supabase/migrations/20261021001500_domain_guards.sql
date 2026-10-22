-- A result cannot be reassigned to a different question/student after correction.
create function private.protect_references() returns trigger language plpgsql set search_path='' as $$
declare k text;
begin
 for k in select key from jsonb_object_keys(to_jsonb(old)) key where key like '%\_id' escape '\' loop
  if to_jsonb(new)->k is distinct from to_jsonb(old)->k then
   raise exception 'Immutable reference: %',k using errcode='23514';
  end if;
 end loop;
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['observations','assessment_results','question_results','rubric_scores','homework_checks','homework_exercise_results','grade_entries','teaching_assignments','classes','class_subjects','assessment_questions'] loop
  execute format('create trigger protect_references before update on public.%I for each row execute function private.protect_references()',t);
 end loop;
end $$;

alter table public.students add constraint students_nonempty check(length(btrim(external_code))>0 and length(btrim(first_name))>0 and length(btrim(last_name))>0);

create function private.validate_subject_link() returns trigger language plpgsql set search_path='' as $$
declare ta uuid; expected uuid; actual uuid;
begin
 if TG_TABLE_NAME='lesson_topics' then select teaching_assignment_id into ta from public.lessons where id=new.lesson_id and workspace_id=new.workspace_id;
 elsif TG_TABLE_NAME='assignment_topics' then select teaching_assignment_id into ta from public.assignments where id=new.assignment_id and workspace_id=new.workspace_id;
 elsif TG_TABLE_NAME in ('observation_topics','observation_competencies') then select teaching_assignment_id into ta from public.observations where id=new.observation_id and workspace_id=new.workspace_id;
 else select teaching_assignment_id into ta from public.assessments where id=new.assessment_id and workspace_id=new.workspace_id;
 end if;
 select cs.subject_id into expected from public.teaching_assignments a join public.class_subjects cs on (cs.workspace_id,cs.id)=(a.workspace_id,a.class_subject_id) where a.id=ta and a.workspace_id=new.workspace_id;
 if to_jsonb(new)->>'topic_id' is not null then
  select subject_id into actual from public.topics where id=(to_jsonb(new)->>'topic_id')::uuid and workspace_id=new.workspace_id;
  if actual is distinct from expected then raise exception 'Topic subject mismatch' using errcode='23514'; end if;
 end if;
 if to_jsonb(new)->>'competency_id' is not null then
  select subject_id into actual from public.competencies where id=(to_jsonb(new)->>'competency_id')::uuid and workspace_id=new.workspace_id;
  if actual is distinct from expected then raise exception 'Competency subject mismatch' using errcode='23514'; end if;
 end if;
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['lesson_topics','assignment_topics','observation_topics','observation_competencies','assessment_questions'] loop
  execute format('create trigger validate_subject_link before insert or update on public.%I for each row execute function private.validate_subject_link()',t);
 end loop;
end $$;

create function public.remove_workspace_member(p_workspace uuid,p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.workspaces where id=p_workspace for update;
 if private.member_role(p_workspace) is distinct from 'owner' or p_user=auth.uid() then raise exception 'Owner required; cannot remove owner' using errcode='42501'; end if;
 -- Remove assignment records through archival first; FK prevents orphan memberships.
 delete from public.workspace_members where workspace_id=p_workspace and user_id=p_user;
end $$;
revoke all on function public.remove_workspace_member(uuid,uuid) from public,anon;
grant execute on function public.remove_workspace_member(uuid,uuid) to authenticated;
revoke all on function private.protect_references(),private.validate_subject_link() from public,anon,authenticated;
