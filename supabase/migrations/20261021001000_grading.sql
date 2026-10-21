create unique index grade_unique_assessment on public.grade_entries(workspace_id,assessment_result_id) where assessment_result_id is not null;
create unique index grade_unique_observation on public.grade_entries(workspace_id,observation_id) where observation_id is not null;
create unique index grade_unique_homework on public.grade_entries(workspace_id,homework_check_id) where homework_check_id is not null;
create function public.propose_grade(p_ratio numeric,p_min numeric,p_max numeric,p_step numeric,p_points jsonb)
returns numeric language plpgsql immutable set search_path='' as $$
declare i integer; x numeric; y numeric; px numeric; py numeric; normalized numeric; last_x numeric:=-1;
begin
 if p_ratio is null or p_ratio<0 or p_ratio>1 or p_max<=p_min or p_step<=0
 or jsonb_typeof(p_points)<>'array' or jsonb_array_length(p_points)<2 then raise exception 'Invalid grading rule'; end if;
 for i in 0..jsonb_array_length(p_points)-1 loop
  if jsonb_typeof(p_points->i)<>'array' or jsonb_array_length(p_points->i)<>2 then raise exception 'Invalid conversion point'; end if;
  x:=(p_points->i->>0)::numeric; y:=(p_points->i->>1)::numeric;
  if x is null or y is null or x<0 or x>1 or y<0 or y>1 or x<=last_x or (i>0 and y<py) then raise exception 'Invalid conversion curve'; end if;
  if i=0 and x<>0 then raise exception 'Curve must start at 0'; end if;
  if i>0 and p_ratio between px and x then normalized:=py+(y-py)*(p_ratio-px)/(x-px); end if;
  px:=x; py:=y; last_x:=x;
 end loop;
 if x<>1 then raise exception 'Curve must end at 1'; end if;
 return greatest(p_min,least(p_max,round((p_min+normalized*(p_max-p_min))/p_step)*p_step));
end $$;
revoke all on function public.propose_grade(numeric,numeric,numeric,numeric,jsonb) from public,anon;
grant execute on function public.propose_grade(numeric,numeric,numeric,numeric,jsonb) to authenticated;

create function private.validate_rule() returns trigger language plpgsql set search_path='' as $$
begin
 perform public.propose_grade(0,new.minimum,new.maximum,new.rounding_step,new.conversion_points);
 return new;
end $$;
create trigger validate_rule before insert or update on public.evaluation_rules for each row execute function private.validate_rule();

create function private.validate_grade() returns trigger language plpgsql set search_path='' as $$
declare rule public.evaluation_rules; obs public.observations; hc public.homework_checks; a public.assignments;
 ratio numeric; source_snapshot jsonb:='{}'; q jsonb; cat public.evaluation_categories;
begin
 select * into strict rule from public.evaluation_rules where id=new.rule_id and workspace_id=new.workspace_id and deleted_at is null;
 select * into strict cat from public.evaluation_categories where id=new.category_id and workspace_id=new.workspace_id and deleted_at is null;
 if new.confirmed_value is not null and (new.confirmed_value<rule.minimum or new.confirmed_value>rule.maximum) then raise exception 'Grade out of range' using errcode='23514'; end if;
 if new.observation_id is not null then
  select * into strict obs from public.observations where id=new.observation_id and workspace_id=new.workspace_id and deleted_at is null;
  if obs.mode<>'GRADED' then raise exception 'Descriptive observations cannot have grades' using errcode='23514'; end if;
  source_snapshot:=to_jsonb(obs)||jsonb_build_object('observation_type',(select to_jsonb(t) from public.observation_types t where t.id=obs.observation_type_id and t.workspace_id=obs.workspace_id));
 elsif new.homework_check_id is not null then
  select * into strict hc from public.homework_checks where id=new.homework_check_id and workspace_id=new.workspace_id and deleted_at is null;
  select * into strict a from public.assignments where id=hc.assignment_id and workspace_id=new.workspace_id;
  if hc.enrollment_id<>new.enrollment_id or a.teaching_assignment_id<>new.teaching_assignment_id then raise exception 'Homework grade mismatch' using errcode='23514'; end if;
  source_snapshot:=to_jsonb(hc);
 elsif new.assessment_result_id is not null then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into q from public.question_results x where x.assessment_result_id=new.assessment_result_id and x.workspace_id=new.workspace_id and x.deleted_at is null;
  select case when sum(max_score_snapshot)>0 then sum(coalesce(score,case quick_result when 'good' then max_score_snapshot when 'partial' then max_score_snapshot/2 else 0 end))/sum(max_score_snapshot) end into ratio
   from public.question_results where assessment_result_id=new.assessment_result_id and workspace_id=new.workspace_id and deleted_at is null;
  if exists(select 1 from public.rubric_scores where assessment_result_id=new.assessment_result_id and workspace_id=new.workspace_id and deleted_at is null) then
   select sum(score/max_score_snapshot*weight_snapshot)/sum(weight_snapshot) into ratio from public.rubric_scores where assessment_result_id=new.assessment_result_id and workspace_id=new.workspace_id and deleted_at is null;
  end if;
  select jsonb_build_object('questions',q,'rubric',coalesce(jsonb_agg(to_jsonb(x)),'[]')) into source_snapshot from public.rubric_scores x where x.assessment_result_id=new.assessment_result_id and x.workspace_id=new.workspace_id and x.deleted_at is null;
 end if;
 if ratio is not null then new.suggested_value:=public.propose_grade(ratio,rule.minimum,rule.maximum,rule.rounding_step,rule.conversion_points); end if;
 if TG_OP='UPDATE' and old.confirmed_value is distinct from new.confirmed_value and nullif(btrim(new.change_reason),'') is null then raise exception 'Grade change reason required' using errcode='23514'; end if;
 new.calculation_snapshot:=jsonb_build_object('rule',to_jsonb(rule),'category',to_jsonb(cat),'source',source_snapshot,'ratio',ratio,'captured_at',clock_timestamp());
 return new;
end $$;
create trigger validate_grade before insert or update on public.grade_entries for each row execute function private.validate_grade();

create table public.grade_audit_log(
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null,
 grade_entry_id uuid not null, actor_id uuid references public.profiles(id),
 operation text not null, old_record jsonb, new_record jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 foreign key(workspace_id,grade_entry_id) references public.grade_entries(workspace_id,id)
);
alter table public.grade_audit_log enable row level security;
revoke all on public.grade_audit_log from anon,authenticated;
grant select on public.grade_audit_log to authenticated;
create policy audit_select on public.grade_audit_log for select to authenticated using(exists(
 select 1 from public.grade_entries g where g.id=grade_entry_id and g.workspace_id=grade_audit_log.workspace_id));
create policy audit_insert on public.grade_audit_log for insert to authenticated with check(false);
create policy audit_update on public.grade_audit_log for update to authenticated using(false) with check(false);
create policy audit_delete on public.grade_audit_log for delete to authenticated using(false);
create index audit_grade_time on public.grade_audit_log(workspace_id,grade_entry_id,created_at);
create function private.audit_grade() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.grade_audit_log(workspace_id,grade_entry_id,actor_id,operation,old_record,new_record)
 values(new.workspace_id,new.id,auth.uid(),TG_OP,case when TG_OP='UPDATE' then to_jsonb(old) end,to_jsonb(new));
 return new;
end $$;
create trigger audit_grade after insert or update on public.grade_entries for each row execute function private.audit_grade();

create function private.validate_result() returns trigger language plpgsql set search_path='' as $$
declare q public.assessment_questions; c public.rubric_criteria; expected_rubric uuid; mode text;
begin
 if TG_TABLE_NAME='question_results' then
  select * into strict q from public.assessment_questions where id=new.question_id and workspace_id=new.workspace_id and deleted_at is null;
  select correction_mode into mode from public.assessments where id=new.assessment_id and workspace_id=new.workspace_id;
  if mode='rubric' or (mode='quick' and (new.quick_result is null or new.score is not null)) or (mode='analytic' and (new.score is null or new.quick_result is not null)) then raise exception 'Correction mode mismatch' using errcode='23514'; end if;
  if exists(select 1 from public.assessment_questions where parent_question_id=q.id and workspace_id=q.workspace_id and deleted_at is null) then raise exception 'Score leaf questions only' using errcode='23514'; end if;
  if TG_OP='INSERT' then new.max_score_snapshot:=q.max_score;
  elsif new.max_score_snapshot<>old.max_score_snapshot then raise exception 'Immutable score snapshot' using errcode='23514'; end if;
 else
  select * into strict c from public.rubric_criteria where id=new.criterion_id and workspace_id=new.workspace_id and deleted_at is null;
  select a.rubric_id,a.correction_mode into expected_rubric,mode from public.assessments a join public.assessment_results r on r.assessment_id=a.id and r.workspace_id=a.workspace_id where r.id=new.assessment_result_id and r.workspace_id=new.workspace_id;
  if c.rubric_id is distinct from expected_rubric or mode<>'rubric' then raise exception 'Rubric mismatch' using errcode='23514'; end if;
  if TG_OP='INSERT' then new.criterion_label_snapshot:=c.label; new.levels_snapshot:=c.levels; new.max_score_snapshot:=c.max_score; new.weight_snapshot:=c.weight;
  elsif (new.criterion_label_snapshot,new.levels_snapshot,new.max_score_snapshot,new.weight_snapshot) is distinct from (old.criterion_label_snapshot,old.levels_snapshot,old.max_score_snapshot,old.weight_snapshot) then raise exception 'Immutable rubric snapshot' using errcode='23514'; end if;
 end if;
 return new;
end $$;
create trigger validate_result before insert or update on public.question_results for each row execute function private.validate_result();
create trigger validate_result before insert or update on public.rubric_scores for each row execute function private.validate_result();
create function private.protect_observation() returns trigger language plpgsql set search_path='' as $$
begin
 if new.mode='DESCRIPTIVE' and exists(select 1 from public.grade_entries where observation_id=new.id and workspace_id=new.workspace_id) then raise exception 'Observation has a canonical grade' using errcode='23514'; end if;
 return new;
end $$;
create trigger protect_observation before update on public.observations for each row execute function private.protect_observation();
