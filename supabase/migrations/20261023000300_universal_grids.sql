-- Reuse rubrics as templates, hierarchical questions as sections/exercises and question_results as the single score source.
alter table public.assessment_rubrics add column grid_definition jsonb;
alter table public.assessment_rubrics add column archived_at timestamptz;
alter table public.assessments add column grid_snapshot jsonb;
alter table public.assessments add column grid_request_hash text;
alter table public.assessment_questions add column grid_position integer not null default 0;
alter table public.question_results add column criterion_scores jsonb;
alter table public.evaluation_rules add column conversion_mode text not null default 'curve' check(conversion_mode in ('curve','linear','bands'));
alter table public.evaluation_rules add column bands jsonb not null default '[]' check(jsonb_typeof(bands)='array');
alter table public.evaluation_rules add column band_maximum numeric not null default 80 check(band_maximum>0);
alter table public.evaluation_rules add column pass_mark numeric;

-- A shared template can be used by a private assessment invisible to its author.
-- Check references under a narrow definer to keep those historical assessments readable.
create function private.protect_grid_template_history() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.deleted_at is not null and old.deleted_at is null and exists(select 1 from public.assessments where workspace_id=new.workspace_id and rubric_id=new.id and deleted_at is null) then raise exception 'Modello utilizzato: usa l’archiviazione della griglia per conservare lo storico.' using errcode='23514';end if;
 return new;
end $$;
revoke all on function private.protect_grid_template_history() from public,anon,authenticated;
create trigger protect_grid_template_history before update on public.assessment_rubrics for each row execute function private.protect_grid_template_history();

create function public.validate_grid_definition(g jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare s jsonb; e jsonb; c jsonb; skill jsonb; level jsonb; total numeric:=0; section_total numeric; exercise_total numeric; skill_total numeric; ids text[]:=array[]::text[]; previous numeric; maximum numeric;
begin
 if g is null or jsonb_typeof(g) is distinct from 'object' or nullif(btrim(g->>'title'),'') is null or coalesce((g->>'maximum')::numeric,0)<=0 or coalesce(g->>'maximum','')!~'^[0-9]+(\.[0-9]{1,3})?$' or g->>'precision' is null or (g->>'precision')::integer not between 0 and 3 or jsonb_typeof(g->'sections') is distinct from 'array' or jsonb_array_length(g->'sections')=0 or jsonb_array_length(g->'sections')>100 or jsonb_typeof(g->'competencies') is distinct from 'array' then raise exception 'Completa titolo, massimo positivo, competenze e sezioni della griglia.' using errcode='23514'; end if;
 for s in select value from jsonb_array_elements(g->'sections') loop
  section_total:=0;
  if nullif(btrim(s->>'label'),'') is null or nullif(s->>'id','') is null or s->>'id'=any(ids) or jsonb_typeof(s->'exercises') is distinct from 'array' or jsonb_array_length(s->'exercises')=0 then raise exception 'Sezione non valida o identificativo duplicato.' using errcode='23514'; end if;ids:=array_append(ids,s->>'id');
  for e in select value from jsonb_array_elements(s->'exercises') loop
   exercise_total:=0;
   if nullif(btrim(e->>'label'),'') is null or nullif(e->>'id','') is null or e->>'id'=any(ids) or jsonb_typeof(e->'criteria') is distinct from 'array' or jsonb_array_length(e->'criteria')=0 or jsonb_array_length(e->'criteria')>100 then raise exception 'Esercizio non valido o senza sottocriteri.' using errcode='23514'; end if;ids:=array_append(ids,e->>'id');
   for c in select value from jsonb_array_elements(e->'criteria') loop
    maximum:=(c->>'maximum')::numeric;
    if nullif(btrim(c->>'label'),'') is null or nullif(c->>'id','') is null or c->>'id'=any(ids) or maximum is null or maximum<=0 or coalesce(c->>'maximum','')!~'^[0-9]+(\.[0-9]{1,3})?$' or maximum<>round(maximum,(g->>'precision')::integer) then raise exception 'Sottocriterio non valido: punti positivi con la precisione scelta.' using errcode='23514'; end if;ids:=array_append(ids,c->>'id');
    if nullif(c->>'competency_id','') is not null and not exists(select 1 from jsonb_array_elements(g->'competencies') x where x->>'id'=c->>'competency_id') then raise exception 'Competenza del sottocriterio non presente nella griglia.' using errcode='23514'; end if;
    previous:=0;
    for level in select value from jsonb_array_elements(coalesce(c->'levels','[]')) loop
     if nullif(btrim(level->>'label'),'') is null or (level->>'from')::numeric is distinct from previous or (level->>'to')::numeric is null or (level->>'to')::numeric<=previous or (level->>'to')::numeric>maximum then raise exception 'Intervalli dei livelli non contigui o fuori limite.' using errcode='23514'; end if;
     previous:=(level->>'to')::numeric;
    end loop;
    if jsonb_array_length(coalesce(c->'levels','[]'))>0 and previous<>maximum then raise exception 'I livelli devono coprire tutto il massimo del sottocriterio.' using errcode='23514'; end if;
    exercise_total:=exercise_total+maximum;
   end loop;
   if exercise_total is distinct from (e->>'maximum')::numeric then raise exception 'La somma dei sottocriteri deve coincidere con il massimo dell’esercizio.' using errcode='23514'; end if;
   section_total:=section_total+exercise_total;
  end loop;
  if section_total is distinct from (s->>'maximum')::numeric then raise exception 'La somma degli esercizi deve coincidere con il massimo della sezione.' using errcode='23514'; end if;total:=total+section_total;
 end loop;
 if total is distinct from (g->>'maximum')::numeric then raise exception 'La somma delle sezioni deve coincidere con il massimo della prova.' using errcode='23514'; end if;
 skill_total:=0;
 for skill in select value from jsonb_array_elements(g->'competencies') loop
  if nullif(skill->>'id','') is null or skill->>'id'=any(ids) or nullif(btrim(skill->>'label'),'') is null or coalesce((skill->>'maximum')::numeric,0)<=0 then raise exception 'Competenza non valida o duplicata.' using errcode='23514'; end if;ids:=array_append(ids,skill->>'id');
  select coalesce(sum((criterion->>'maximum')::numeric),0) into maximum from jsonb_array_elements(g->'sections') section cross join lateral jsonb_array_elements(section->'exercises') exercise cross join lateral jsonb_array_elements(exercise->'criteria') criterion where criterion->>'competency_id'=skill->>'id';
  if maximum<>(skill->>'maximum')::numeric then raise exception 'Ripartizione punti per competenza non rispettata: %',skill->>'label' using errcode='23514'; end if;skill_total:=skill_total+maximum;
 end loop;
 if jsonb_array_length(g->'competencies')>0 and skill_total<>total then raise exception 'Ogni punto deve essere associato a una competenza quando sono previste competenze.' using errcode='23514'; end if;
 return true;
end $$;
revoke all on function public.validate_grid_definition(jsonb) from public,anon;
grant execute on function public.validate_grid_definition(jsonb) to authenticated;

create function public.grid_grade(p_score numeric,p_max numeric,p_rule jsonb) returns numeric language plpgsql immutable set search_path='' as $$
declare answer numeric; threshold numeric; last_threshold numeric:=-1; b jsonb; mode text:=coalesce(p_rule->>'conversion_mode','curve');
begin
 if p_max is null or p_max<=0 or p_score is null or p_score<0 or p_score>p_max or p_max::text in ('NaN','Infinity','-Infinity') or p_score::text in ('NaN','Infinity','-Infinity') then raise exception 'Punteggio fuori dai limiti.' using errcode='23514'; end if;
 if mode='curve' then return public.propose_grade(p_score/p_max,(p_rule->>'minimum')::numeric,(p_rule->>'maximum')::numeric,(p_rule->>'rounding_step')::numeric,p_rule->'conversion_points'); end if;
 if mode='linear' then answer:=p_score/p_max*(p_rule->>'maximum')::numeric;
 elsif mode='bands' then
  for b in select value from jsonb_array_elements(p_rule->'bands') loop
   threshold:=(b->>'from')::numeric;
   if threshold is null or threshold<=last_threshold or threshold<0 or threshold>(p_rule->>'band_maximum')::numeric or (last_threshold=-1 and threshold<>0) or (b->>'grade')::numeric is null or (b->>'grade')::numeric<(p_rule->>'minimum')::numeric or (b->>'grade')::numeric>(p_rule->>'maximum')::numeric then raise exception 'Fasce non valide: soglie crescenti da zero e voti nei limiti.' using errcode='23514'; end if;
   if p_score/p_max*(p_rule->>'band_maximum')::numeric>=threshold then answer:=(b->>'grade')::numeric;end if;last_threshold:=threshold;
  end loop;
  if answer is null then raise exception 'Fasce non configurate.' using errcode='23514'; end if;
 else raise exception 'Conversione non valida.' using errcode='23514';end if;
 return greatest((p_rule->>'minimum')::numeric,least((p_rule->>'maximum')::numeric,round(answer/(p_rule->>'rounding_step')::numeric)*(p_rule->>'rounding_step')::numeric));
end $$;
revoke all on function public.grid_grade(numeric,numeric,jsonb) from public,anon;
grant execute on function public.grid_grade(numeric,numeric,jsonb) to authenticated;

create function private.validate_grid_record() returns trigger language plpgsql set search_path='' as $$
declare snapshot jsonb; exercise jsonb; criterion jsonb; obtained numeric; total numeric:=0; max_points numeric; k text;
begin
 if TG_TABLE_NAME='assessment_rubrics' then
  if new.grid_definition is not null then perform public.validate_grid_definition(new.grid_definition);end if;
 elsif TG_TABLE_NAME='evaluation_rules' then
  if new.minimum::text in ('NaN','Infinity','-Infinity') or new.maximum::text in ('NaN','Infinity','-Infinity') or new.rounding_step::text in ('NaN','Infinity','-Infinity') or new.band_maximum::text in ('NaN','Infinity','-Infinity') or new.pass_mark::text in ('NaN','Infinity','-Infinity') then raise exception 'La regola richiede numeri finiti.' using errcode='23514';end if;
  if new.pass_mark<new.minimum or new.pass_mark>new.maximum then raise exception 'Sufficienza fuori dai limiti del voto.' using errcode='23514'; end if;
  perform public.grid_grade(0,100,to_jsonb(new));
 elsif TG_TABLE_NAME='assessments' then
  if TG_OP='UPDATE' and (new.grid_snapshot,new.grid_request_hash) is distinct from (old.grid_snapshot,old.grid_request_hash) then raise exception 'Snapshot immutabile: duplica la verifica per cambiare struttura o conversione.' using errcode='23514';end if;
  if new.grid_snapshot is not null then
   perform public.validate_grid_definition(new.grid_snapshot);
   if TG_OP='INSERT' and not exists(select 1 from public.evaluation_rules r where r.workspace_id=new.workspace_id and r.id=new.evaluation_rule_id and r.deleted_at is null and to_jsonb(r)=new.grid_snapshot->'rule') then raise exception 'La conversione deve corrispondere alla regola autorizzata corrente.' using errcode='23514';end if;
   if new.correction_mode<>'analytic' or new.grid_snapshot->'rule' is null then raise exception 'Griglia universale richiede modalità analitica e snapshot della regola.' using errcode='23514';end if;
  end if;
 elsif TG_TABLE_NAME='assessment_questions' then
  select grid_snapshot into snapshot from public.assessments where workspace_id=new.workspace_id and id=new.assessment_id;
  if snapshot is not null then
   if TG_OP='UPDATE' and (new.label,new.max_score,new.parent_question_id,new.deleted_at,new.grid_position) is distinct from (old.label,old.max_score,old.parent_question_id,old.deleted_at,old.grid_position) then raise exception 'Struttura della griglia salvata immutabile: duplica la verifica.' using errcode='23514';end if;
   if new.parent_question_id is null then select s into exercise from jsonb_array_elements(snapshot->'sections') s where s->>'id'=new.id::text;
   else select e into exercise from jsonb_array_elements(snapshot->'sections') s cross join lateral jsonb_array_elements(s->'exercises') e where e->>'id'=new.id::text and s->>'id'=new.parent_question_id::text;end if;
   if exercise is null or new.max_score<>(exercise->>'maximum')::numeric or new.label<>exercise->>'label' then raise exception 'Quesito non coerente con lo snapshot della griglia.' using errcode='23514';end if;
  end if;
 else
  select a.grid_snapshot into snapshot from public.assessment_results r join public.assessments a on (a.workspace_id,a.id)=(r.workspace_id,r.assessment_id) where r.workspace_id=new.workspace_id and r.id=new.assessment_result_id;
  if snapshot is not null then
   select e into exercise from jsonb_array_elements(snapshot->'sections') s cross join lateral jsonb_array_elements(s->'exercises') e where e->>'id'=new.question_id::text;
   if exercise is null then raise exception 'Esercizio non presente nello snapshot.' using errcode='23514';end if;
   if new.criterion_scores is not null then
    if jsonb_typeof(new.criterion_scores) is distinct from 'object' then raise exception 'Punteggi analitici non validi.' using errcode='23514';end if;
    for k in select jsonb_object_keys(new.criterion_scores) loop
     select c into criterion from jsonb_array_elements(exercise->'criteria') c where c->>'id'=k;
     obtained:=(new.criterion_scores->>k)::numeric;
     if criterion is null or obtained is null or obtained<0 or obtained>(criterion->>'maximum')::numeric or obtained<>round(obtained,(snapshot->>'precision')::integer) then raise exception 'Punteggio del sottocriterio fuori dai limiti.' using errcode='23514';end if;total:=total+obtained;
    end loop;
    new.score:=total;
   end if;
   if new.score is null or new.score<>round(new.score,(snapshot->>'precision')::integer) or new.score<0 or new.score>(exercise->>'maximum')::numeric then raise exception 'Punteggio esercizio non valido.' using errcode='23514';end if;
  elsif new.criterion_scores is not null then raise exception 'Dettaglio griglia disponibile soltanto per verifiche con snapshot.' using errcode='23514';end if;
 end if;
 return new;
end $$;
create trigger validate_grid before insert or update on public.assessment_rubrics for each row execute function private.validate_grid_record();
create trigger validate_grid before insert or update on public.evaluation_rules for each row execute function private.validate_grid_record();
create trigger validate_grid before insert or update on public.assessments for each row execute function private.validate_grid_record();
create trigger validate_grid before insert or update on public.assessment_questions for each row execute function private.validate_grid_record();
create trigger validate_a_grid before insert or update on public.question_results for each row execute function private.validate_grid_record();
revoke all on function private.validate_grid_record() from public,anon,authenticated;

create function public.create_grid_assessment(p_workspace uuid,p_operation uuid,p_template uuid,p_template_version bigint,p_definition jsonb,p_assignment uuid,p_title text,p_date date,p_kind text,p_rule uuid,p_rule_version bigint) returns uuid
language plpgsql security invoker set search_path='' as $$
declare template public.assessment_rubrics; rule public.evaluation_rules; assignment public.teaching_assignments; existing public.assessments; g jsonb; s jsonb; e jsonb; request text; position integer:=0;
begin
 if not coalesce(private.member_role(p_workspace) in ('owner','admin','teacher'),false) then raise insufficient_privilege;end if;
 if p_operation is null or nullif(btrim(p_title),'') is null or p_date is null or p_kind not in ('written','oral','practical','graded_exercise') then raise exception 'Completa titolo, data e tipo di prova.';end if;
 request:=md5(jsonb_build_array(p_template,p_template_version,p_definition,p_assignment,p_title,p_date,p_kind,p_rule,p_rule_version)::text);
 perform pg_advisory_xact_lock(hashtextextended(p_operation::text,23));
 select * into existing from public.assessments where id=p_operation and workspace_id=p_workspace;
 if found then
  if existing.created_by<>auth.uid() or existing.grid_request_hash is distinct from request then raise exception 'Identificativo già usato per una verifica diversa.' using errcode='22023';end if;return existing.id;
 end if;
 select * into strict assignment from public.teaching_assignments where workspace_id=p_workspace and id=p_assignment and deleted_at is null;
 select * into strict rule from public.evaluation_rules where workspace_id=p_workspace and id=p_rule and deleted_at is null;
 if rule.version is distinct from p_rule_version then raise exception 'Regola modificata: aggiorna l’anteprima.' using errcode='PT409';end if;
 if p_template is not null then
  select * into strict template from public.assessment_rubrics where workspace_id=p_workspace and id=p_template and deleted_at is null and archived_at is null;
  if template.version is distinct from p_template_version then raise exception 'Modello modificato: aggiorna l’anteprima.' using errcode='PT409';end if;
 end if;
 -- p_definition is the explicitly reviewed personal adaptation, never a live link to the template.
 g:=p_definition;
 perform public.validate_grid_definition(g);
 -- Template keys are stable inside the model; question UUIDs must be unique per assessment.
 select jsonb_set(g,'{sections}',jsonb_agg(s.value||jsonb_build_object('id',md5(p_operation::text||'section'||(s.value->>'id'))::uuid::text,'exercises',
  (select jsonb_agg(e.value||jsonb_build_object('id',md5(p_operation::text||'exercise'||(e.value->>'id'))::uuid::text) order by e.n) from jsonb_array_elements(s.value->'exercises') with ordinality e(value,n))) order by s.n)) into g
 from jsonb_array_elements(g->'sections') with ordinality s(value,n);
 if nullif(g->>'subject_id','') is not null and not exists(select 1 from public.class_subjects where workspace_id=p_workspace and id=assignment.class_subject_id and subject_id=(g->>'subject_id')::uuid) then raise exception 'Materia della griglia diversa dall’incarico.' using errcode='23514';end if;
 g:=g||jsonb_build_object('rule',to_jsonb(rule),'template_id',p_template,'template_version',p_template_version);
 insert into public.assessments(id,workspace_id,created_by,teaching_assignment_id,class_id,title,assessed_on,kind,correction_mode,rubric_id,evaluation_rule_id,grid_snapshot,grid_request_hash)
 values(p_operation,p_workspace,auth.uid(),assignment.id,assignment.class_id,p_title,p_date,p_kind,'analytic',p_template,p_rule,g,request);
 for s in select value from jsonb_array_elements(g->'sections') loop
  insert into public.assessment_questions(id,workspace_id,created_by,assessment_id,label,max_score,grid_position) values((s->>'id')::uuid,p_workspace,auth.uid(),p_operation,s->>'label',(s->>'maximum')::numeric,position);
  position:=position+1;
  for e in select value from jsonb_array_elements(s->'exercises') loop
   insert into public.assessment_questions(id,workspace_id,created_by,assessment_id,parent_question_id,label,max_score,grid_position) values((e->>'id')::uuid,p_workspace,auth.uid(),p_operation,(s->>'id')::uuid,e->>'label',(e->>'maximum')::numeric,position);position:=position+1;
  end loop;
 end loop;
 return p_operation;
end $$;
revoke all on function public.create_grid_assessment(uuid,uuid,uuid,bigint,jsonb,uuid,text,date,text,uuid,bigint) from public,anon;
grant execute on function public.create_grid_assessment(uuid,uuid,uuid,bigint,jsonb,uuid,text,date,text,uuid,bigint) to authenticated;

-- Preserve legacy grading/audit; only grid assessments resolve their frozen rule.
create or replace function private.validate_grade() returns trigger language plpgsql set search_path='' as $$
declare rule public.evaluation_rules; obs public.observations; hc public.homework_checks; a public.assignments;
 grid jsonb; ratio numeric; source_snapshot jsonb:='{}'; q jsonb; cat public.evaluation_categories;
begin

 if new.assessment_result_id is not null then
  select grid_assessment.grid_snapshot into grid from public.assessment_results r join public.assessments grid_assessment on (grid_assessment.workspace_id,grid_assessment.id)=(r.workspace_id,r.assessment_id) where r.workspace_id=new.workspace_id and r.id=new.assessment_result_id;
 end if;
 if grid is not null then
  select * into rule from jsonb_populate_record(null::public.evaluation_rules,grid->'rule');
  if new.rule_id is distinct from rule.id then raise exception 'La verifica usa la regola catturata nello snapshot.' using errcode='23514';end if;
 else
  select * into strict rule from public.evaluation_rules where id=new.rule_id and workspace_id=new.workspace_id and deleted_at is null;
 end if;
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

create function private.validate_grid_grade() returns trigger language plpgsql set search_path='' as $$
declare g jsonb; scores jsonb; total numeric; expected integer; actual integer; detail_ok boolean;
begin
 if new.assessment_result_id is null then return new;end if;
 select a.grid_snapshot into g from public.assessment_results r join public.assessments a on (a.workspace_id,a.id)=(r.workspace_id,r.assessment_id) where r.workspace_id=new.workspace_id and r.id=new.assessment_result_id;
 if g is null then return new;end if;
 select count(*) into expected from jsonb_array_elements(g->'sections') s cross join lateral jsonb_array_elements(s->'exercises') e;
 select coalesce(sum(q.score),0),coalesce(jsonb_agg(to_jsonb(q) order by q.question_id),'[]'),count(*) into total,scores,actual from public.question_results q where q.workspace_id=new.workspace_id and q.assessment_result_id=new.assessment_result_id and q.deleted_at is null;
 select not exists(
  select 1 from jsonb_array_elements(g->'sections') s cross join lateral jsonb_array_elements(s->'exercises') e
  left join public.question_results q on q.workspace_id=new.workspace_id and q.assessment_result_id=new.assessment_result_id and q.question_id=(e->>'id')::uuid and q.deleted_at is null
  where q.id is null or (q.criterion_scores is not null and (select count(*) from jsonb_object_keys(q.criterion_scores))<>jsonb_array_length(e->'criteria'))
 ) into detail_ok;
 if new.status='confirmed' and (expected=0 or expected<>actual or not detail_ok) then raise exception 'Completa ogni esercizio e i sottocriteri analitici iniziati prima di confermare.' using errcode='23514';end if;
 new.suggested_value:=public.grid_grade(total,(g->>'maximum')::numeric,g->'rule');
 new.calculation_snapshot:=new.calculation_snapshot||jsonb_build_object('rule',g->'rule','grid',g,'source',jsonb_build_object('questions',scores),'ratio',total/(g->>'maximum')::numeric,'total_points',total,'maximum_points',(g->>'maximum')::numeric,'complete',detail_ok and expected=actual);
 return new;
end $$;
create trigger validate_y_grid_grade before insert or update on public.grade_entries for each row execute function private.validate_grid_grade();
revoke all on function private.validate_grid_grade() from public,anon,authenticated;

create view public.v_grid_competency_progress with(security_invoker=true) as
select r.workspace_id,r.enrollment_id,a.id assessment_id,skill->>'id' competency_key,skill->>'label' competency_label,
 sum((q.criterion_scores->>(criterion->>'id'))::numeric) obtained,
 sum((criterion->>'maximum')::numeric) available_maximum,count(q.id) evidence_count,
 count(*) filter(where q.criterion_scores is null or not(q.criterion_scores ? (criterion->>'id'))) missing_detail_count
from public.assessments a join public.assessment_results r on (r.workspace_id,r.assessment_id)=(a.workspace_id,a.id)
cross join lateral jsonb_array_elements(a.grid_snapshot->'competencies') skill
cross join lateral jsonb_array_elements(a.grid_snapshot->'sections') section
cross join lateral jsonb_array_elements(section->'exercises') exercise
cross join lateral jsonb_array_elements(exercise->'criteria') criterion
left join public.question_results q on q.workspace_id=r.workspace_id and q.assessment_result_id=r.id and q.question_id=(exercise->>'id')::uuid and q.deleted_at is null
where a.deleted_at is null and r.deleted_at is null and criterion->>'competency_id'=skill->>'id'
group by r.workspace_id,r.enrollment_id,a.id,skill->>'id',skill->>'label';
revoke all on public.v_grid_competency_progress from public,anon,authenticated;
grant select on public.v_grid_competency_progress to authenticated;
