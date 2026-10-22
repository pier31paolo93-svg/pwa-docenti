-- Read-only role/RLS checks. No login, passwords, fixture writes or account changes.
begin read only;
set local statement_timeout='15s';
do $$
declare owner_row record; previous_role text:=current_user; checked integer:=0;
begin
 for owner_row in select w.id,w.owner_id from public.workspaces w
 join public.workspace_members m on m.workspace_id=w.id and m.user_id=w.owner_id
 where w.deleted_at is null and m.role='owner' and m.revoked_at is null loop
  perform set_config('request.jwt.claim.sub',owner_row.owner_id::text,true);
  execute 'set local role authenticated';
  perform 1 from public.v_homework_completion limit 1;
  if exists(select 1 from public.v_homework_completion where workspace_id<>owner_row.id) then
   raise exception 'FAIL cross-workspace view read';
  end if;
  execute format('set local role %I',previous_role);
  checked:=checked+1;
 end loop;
 if checked<>2 then raise exception 'FAIL expected two Owner workspaces';end if;
 execute 'set local role anon';
 begin
  perform 1 from public.v_homework_completion limit 1;
  raise exception 'FAIL anonymous SELECT accepted';
 exception when insufficient_privilege then null;end;
 execute format('set local role %I',previous_role);
 raise notice 'PASS SELECT as both Owners, no cross-workspace view rows, anonymous SELECT denied';
end $$;
rollback;
