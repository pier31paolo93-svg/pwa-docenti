\set VERBOSITY verbose
begin;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
update public.students set first_name='Concurrent B',version=2
where external_code='TEST-1-1' and workspace_id=(select id from public.workspaces where owner_id=auth.uid());
commit;
