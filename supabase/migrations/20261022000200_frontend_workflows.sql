-- Incremental phase-2 extension. LOCAL ONLY until explicitly approved for cloud.
alter table public.homework_checks add column excused boolean not null default false;
alter table public.homework_checks add column excuse_reason text;
alter table public.homework_checks add constraint homework_excuse_reason
 check(not excused or nullif(btrim(excuse_reason),'') is not null);
alter table public.assessments add column evaluation_rule_id uuid;
alter table public.assessments add constraint assessments_default_rule_fk
 foreign key(workspace_id,evaluation_rule_id) references public.evaluation_rules(workspace_id,id);
create index assessments_evaluation_rule_idx on public.assessments(workspace_id,evaluation_rule_id);
insert into private.access_links(table_name,column_name,parent_table)
 values('assessments','evaluation_rule_id','evaluation_rules');
create view public.v_homework_completion with (security_invoker=true) as
select h.workspace_id,h.id,h.enrollment_id,h.assignment_id,h.excused,h.excuse_reason,
 case when h.excused then 'excused'
      when s.total_exercises is null then 'unchecked'
      when s.not_done=0 then 'complete'
      when s.not_done=s.total_exercises then 'not_done'
      else 'partial' end as completion_status,
 case when h.excused then null else s.completed_percent end as completed_percent
from public.homework_checks h left join public.v_homework_summary s
 on s.workspace_id=h.workspace_id and s.homework_check_id=h.id
where h.deleted_at is null;
revoke all on public.v_homework_completion from public,anon;
grant select on public.v_homework_completion to authenticated;

-- PostgREST 14 retries SQLSTATE 40001 indefinitely. Keep the original RPC and
-- SQL contract intact; expose a security-invoker HTTP adapter returning 409.
create function public.frontend_sync_mutation(p_operation uuid,p_table text,p_id uuid,p_workspace uuid,p_expected_version bigint,p_patch jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 return public.sync_mutation(p_operation,p_table,p_id,p_workspace,p_expected_version,p_patch);
exception when serialization_failure then
 raise sqlstate 'PT409' using message='Version conflict';
end $$;
revoke all on function public.frontend_sync_mutation(uuid,text,uuid,uuid,bigint,jsonb) from public,anon;
grant execute on function public.frontend_sync_mutation(uuid,text,uuid,uuid,bigint,jsonb) to authenticated;

create function public.frontend_apply_import(p_batch uuid,p_expected_version bigint)
returns integer language plpgsql security invoker set search_path='' as $$
begin
 return public.apply_import(p_batch,p_expected_version);
exception when serialization_failure then
 raise sqlstate 'PT409' using message='Version conflict';
end $$;
revoke all on function public.frontend_apply_import(uuid,bigint) from public,anon;
grant execute on function public.frontend_apply_import(uuid,bigint) to authenticated;
