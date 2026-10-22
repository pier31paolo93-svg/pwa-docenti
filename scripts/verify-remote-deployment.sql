-- Non-destructive production verification. SELECT only, no fixture creation.
with app_functions as (
 select p.*,n.nspname as schema_name from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname||'.'||p.proname in ('private.member_role','private.can_read','private.can_write','private.bootstrap_user','private.allowed','private.stamp_record','private.stamp_account','public.set_workspace_member','public.propose_grade','private.validate_rule','private.validate_grade','private.audit_grade','private.validate_result','private.protect_observation','public.sync_mutation','public.preview_import','public.apply_import','public.student_average','private.validate_assessment_completeness','private.assignment_access','private.protect_references','private.validate_subject_link','public.remove_workspace_member')
), app_tables as (
 select c.*,n.nspname as schema_name from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r'
), data_counts as (
 select 'profiles' as table_name,count(*) as row_count from public.profiles
 union all
 select 'workspaces' as table_name,count(*) as row_count from public.workspaces
 union all
 select 'workspace_members' as table_name,count(*) as row_count from public.workspace_members
 union all
 select 'school_years' as table_name,count(*) as row_count from public.school_years
 union all
 select 'schools' as table_name,count(*) as row_count from public.schools
 union all
 select 'subjects' as table_name,count(*) as row_count from public.subjects
 union all
 select 'classes' as table_name,count(*) as row_count from public.classes
 union all
 select 'students' as table_name,count(*) as row_count from public.students
 union all
 select 'enrollments' as table_name,count(*) as row_count from public.enrollments
 union all
 select 'class_subjects' as table_name,count(*) as row_count from public.class_subjects
 union all
 select 'teaching_assignments' as table_name,count(*) as row_count from public.teaching_assignments
 union all
 select 'topics' as table_name,count(*) as row_count from public.topics
 union all
 select 'competencies' as table_name,count(*) as row_count from public.competencies
 union all
 select 'lessons' as table_name,count(*) as row_count from public.lessons
 union all
 select 'lesson_topics' as table_name,count(*) as row_count from public.lesson_topics
 union all
 select 'lesson_activities' as table_name,count(*) as row_count from public.lesson_activities
 union all
 select 'error_types' as table_name,count(*) as row_count from public.error_types
 union all
 select 'assignments' as table_name,count(*) as row_count from public.assignments
 union all
 select 'assignment_topics' as table_name,count(*) as row_count from public.assignment_topics
 union all
 select 'assignment_exercises' as table_name,count(*) as row_count from public.assignment_exercises
 union all
 select 'homework_checks' as table_name,count(*) as row_count from public.homework_checks
 union all
 select 'homework_exercise_results' as table_name,count(*) as row_count from public.homework_exercise_results
 union all
 select 'homework_errors' as table_name,count(*) as row_count from public.homework_errors
 union all
 select 'observation_types' as table_name,count(*) as row_count from public.observation_types
 union all
 select 'observations' as table_name,count(*) as row_count from public.observations
 union all
 select 'observation_errors' as table_name,count(*) as row_count from public.observation_errors
 union all
 select 'observation_competencies' as table_name,count(*) as row_count from public.observation_competencies
 union all
 select 'observation_topics' as table_name,count(*) as row_count from public.observation_topics
 union all
 select 'assessment_rubrics' as table_name,count(*) as row_count from public.assessment_rubrics
 union all
 select 'rubric_criteria' as table_name,count(*) as row_count from public.rubric_criteria
 union all
 select 'assessments' as table_name,count(*) as row_count from public.assessments
 union all
 select 'assessment_questions' as table_name,count(*) as row_count from public.assessment_questions
 union all
 select 'assessment_results' as table_name,count(*) as row_count from public.assessment_results
 union all
 select 'question_results' as table_name,count(*) as row_count from public.question_results
 union all
 select 'question_errors' as table_name,count(*) as row_count from public.question_errors
 union all
 select 'rubric_scores' as table_name,count(*) as row_count from public.rubric_scores
 union all
 select 'evaluation_categories' as table_name,count(*) as row_count from public.evaluation_categories
 union all
 select 'evaluation_rules' as table_name,count(*) as row_count from public.evaluation_rules
 union all
 select 'grade_entries' as table_name,count(*) as row_count from public.grade_entries
 union all
 select 'ai_workspace_settings' as table_name,count(*) as row_count from public.ai_workspace_settings
 union all
 select 'ai_requests' as table_name,count(*) as row_count from public.ai_requests
 union all
 select 'import_batches' as table_name,count(*) as row_count from public.import_batches
 union all
 select 'import_rows' as table_name,count(*) as row_count from public.import_rows
 union all
 select 'grade_audit_log' as table_name,count(*) as row_count from public.grade_audit_log
), checks(name,passed) as (
 select 'PostgreSQL 17',current_setting('server_version_num')::integer between 170000 and 179999
 union all select '17 exact migration versions',(select count(*)=17 and bool_and(version in ('20261021000100','20261021000200','20261021000300','20261021000400','20261021000500','20261021000600','20261021000700','20261021000800','20261021000900','20261021001000','20261021001100','20261021001200','20261021001300','20261021001400','20261021001500','20261021001600','20261022000100')) from supabase_migrations.schema_migrations)
 union all select '44 public application tables',(select count(*)=44 from app_tables)
 union all select '2 private technical tables',(select count(*)=2 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r')
 union all select 'RLS enabled on every public table',not exists(select 1 from app_tables where not relrowsecurity)
 union all select '4 separate policies on every public table',not exists(select 1 from app_tables c left join pg_policy p on p.polrelid=c.oid group by c.oid having count(p.oid)<>4 or count(distinct p.polcmd)<>4)
 union all select '10 public views',(select count(*)=10 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v')
 union all select 'All views security_invoker',not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v' and not coalesce(c.reloptions @> array['security_invoker=true'],false))
 union all select 'No anonymous table or view privileges',not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) privilege where n.nspname in ('public','private') and c.relkind in ('r','v') and has_table_privilege('anon',c.oid,privilege))
 union all select 'Authenticated hard DELETE denied',not exists(select 1 from app_tables c where has_table_privilege('authenticated',c.oid,'DELETE'))
 union all select '23 application functions present',(select count(*)=23 from app_functions)
 union all select 'SECURITY DEFINER search_path safe',not exists(select 1 from app_functions p where p.prosecdef and not coalesce(p.proconfig @> array['search_path=""'],false))
 union all select 'Trusted application function owners',not exists(select 1 from app_functions p join pg_roles r on r.oid=p.proowner where r.rolname not in ('postgres','supabase_admin'))
 union all select 'PUBLIC execute denied for application functions',not exists(select 1 from app_functions p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE')
 union all select 'Anonymous application function execute denied',not exists(select 1 from app_functions p where has_function_privilege('anon',p.oid,'EXECUTE'))
 union all select 'Trigger function direct execute denied',not exists(select 1 from app_functions p where p.prorettype='pg_catalog.trigger'::regtype and has_function_privilege('authenticated',p.oid,'EXECUTE'))
 union all select '7 public RPCs executable by authenticated',(select count(*)=7 and bool_and(has_function_privilege('authenticated',p.oid,'EXECUTE')) from app_functions p where p.schema_name='public')
 union all select 'Private schema inaccessible to anon',not has_schema_privilege('anon','private','USAGE')
 union all select 'Membership direct writes denied',not has_table_privilege('authenticated','public.workspace_members','INSERT,UPDATE,DELETE')
 union all select 'Audit direct writes denied',not has_table_privilege('authenticated','public.grade_audit_log','INSERT,UPDATE,DELETE')
 union all select 'Workspace owner column update denied',not has_column_privilege('authenticated','public.workspaces','owner_id','UPDATE')
 union all select '42 automatic stamp triggers',(select count(*)=42 from pg_trigger t join app_tables c on c.oid=t.tgrelid where not t.tgisinternal and t.tgname in ('stamp_record','stamp_account'))
 union all select 'Grade audit trigger installed',exists(select 1 from pg_trigger t where t.tgrelid='public.grade_entries'::regclass and t.tgfoid='private.audit_grade()'::regprocedure and not t.tgisinternal and t.tgenabled='O')
 union all select 'Auth workspace bootstrap installed',exists(select 1 from pg_trigger t where t.tgrelid='auth.users'::regclass and t.tgfoid='private.bootstrap_user()'::regprocedure and not t.tgisinternal and t.tgenabled='O')
 union all select 'All constraints validated',not exists(select 1 from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in ('public','private') and not c.convalidated)
 union all select 'All indexes valid and ready',not exists(select 1 from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and (not i.indisvalid or not i.indisready))
 union all select 'All public application tables empty',not exists(select 1 from data_counts where row_count<>0)
 union all select 'No Auth user accounts',(select count(*)=0 from auth.users)
 union all select 'Sync operation log empty',(select count(*)=0 from private.sync_operations)
 union all select '56 authorization relation definitions',(select count(*)=56 from private.access_links)
 union all select 'AI disabled',not exists(select 1 from public.ai_workspace_settings where enabled)
 union all select 'Linear decimal grade conversion',public.propose_grade(0.8,1,10,0.1,'[[0,0],[1,1]]')=8.2
 union all select 'Non-linear grade conversion',public.propose_grade(0.5,0,100,1,'[[0,0],[0.5,0.7],[1,1]]')=70
 union all select 'Canonical grade register empty',(select count(*)=0 from public.v_grade_register)
 union all select 'Student average empty without records',public.student_average('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000','2026-01-01','2027-12-31') is null
)
select jsonb_build_object(
 'server_version',current_setting('server_version'),
 'passed',coalesce((select bool_and(coalesce(passed,false)) from checks),false),
 'check_count',(select count(*) from checks),
 'checks',(select jsonb_agg(jsonb_build_object('name',name,'passed',coalesce(passed,false)) order by name) from checks),
 'data_counts',(select jsonb_object_agg(table_name,row_count) from data_counts),
 'object_counts',jsonb_build_object(
  'public_tables',(select count(*) from app_tables),
  'private_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r'),
  'views',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v'),
  'indexes',(select count(*) from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private')),
  'constraints',(select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in ('public','private')),
  'triggers',(select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in ('public','private')),
  'functions',(select count(*) from app_functions),
  'public_policies',(select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'))
) as verification;
