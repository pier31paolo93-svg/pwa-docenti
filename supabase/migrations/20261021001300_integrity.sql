create function private.validate_assessment_completeness() returns trigger language plpgsql set search_path='' as $$
declare aid uuid; mode text; rid uuid; expected integer; actual integer;
begin
 if new.assessment_result_id is null or new.status<>'confirmed' then return new; end if;
 select a.id,a.correction_mode,a.rubric_id into aid,mode,rid from public.assessment_results r join public.assessments a on (a.workspace_id,a.id)=(r.workspace_id,r.assessment_id) where r.id=new.assessment_result_id and r.workspace_id=new.workspace_id;
 if mode='rubric' then
  select count(*) into expected from public.rubric_criteria where workspace_id=new.workspace_id and rubric_id=rid and deleted_at is null;
  select count(*) into actual from public.rubric_scores where workspace_id=new.workspace_id and assessment_result_id=new.assessment_result_id and deleted_at is null;
 else
  select count(*) into expected from public.assessment_questions q where q.workspace_id=new.workspace_id and q.assessment_id=aid and q.deleted_at is null and not exists(select 1 from public.assessment_questions child where child.workspace_id=q.workspace_id and child.parent_question_id=q.id and child.deleted_at is null);
  select count(*) into actual from public.question_results where workspace_id=new.workspace_id and assessment_result_id=new.assessment_result_id and deleted_at is null;
 end if;
 if expected=0 or actual<>expected then raise exception 'Complete correction before confirming grade' using errcode='23514'; end if;
 return new;
end $$;
create trigger validate_z_completeness before insert or update on public.grade_entries for each row execute function private.validate_assessment_completeness();

do $$
declare r record; columns_sql text;
begin
 for r in select c.conrelid,c.conkey,c.conname,cl.relname from pg_constraint c join pg_class cl on cl.oid=c.conrelid join pg_namespace n on n.oid=cl.relnamespace where c.contype='f' and n.nspname='public' loop
  if not exists(select 1 from pg_index i where i.indrelid=r.conrelid and (select array_agg(k.a order by k.n) from unnest(i.indkey) with ordinality k(a,n) where k.n<=cardinality(r.conkey))=r.conkey) then
   select string_agg(quote_ident(a.attname),',' order by k.ord) into columns_sql from unnest(r.conkey) with ordinality k(num,ord) join pg_attribute a on a.attrelid=r.conrelid and a.attnum=k.num;
   execute format('create index %I on public.%I(%s)',left(r.relname,30)||'_fk_'||substr(md5(r.conname),1,12),r.relname,columns_sql);
  end if;
 end loop;
end $$;
