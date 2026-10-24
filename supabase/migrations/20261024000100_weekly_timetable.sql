-- V1.5: incremental. Apply to cloud only after separate explicit authorization.
create table public.timetable_versions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id), visibility text not null default 'workspace' check(visibility='workspace'),
 version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 school_year_id uuid not null, teacher_id uuid not null references public.profiles(id), name text not null check(length(btrim(name))>0),
 kind text not null check(kind in ('provisional','definitive')), status text not null default 'draft' check(status in ('draft','active','archived')),
 valid_from date not null, valid_to date, check(valid_to is null or valid_to>=valid_from),
 unique(workspace_id,id), foreign key(workspace_id,school_year_id) references public.school_years(workspace_id,id)
);
create table public.timetable_slots (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id), visibility text not null default 'workspace' check(visibility='workspace'),
 version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 timetable_version_id uuid not null, teaching_assignment_id uuid not null, weekday integer not null check(weekday between 1 and 7),
 starts_at time not null, ends_at time not null, check(ends_at>starts_at), room text, notes text,
 kind text not null default 'ordinary' check(kind in ('ordinary','laboratory','other')),
 unique(workspace_id,id), unique(workspace_id,id,timetable_version_id),
 foreign key(workspace_id,timetable_version_id) references public.timetable_versions(workspace_id,id),
 foreign key(workspace_id,teaching_assignment_id) references public.teaching_assignments(workspace_id,id)
);
create table public.timetable_exceptions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references public.profiles(id), visibility text not null default 'workspace' check(visibility='workspace'),
 version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 timetable_version_id uuid not null, slot_id uuid, occurs_on date not null,
 kind text not null check(kind in ('cancelled','substitution','room','swap','trip','reduced','extra','additional')),
 teaching_assignment_id uuid, starts_at time, ends_at time, room text, notes text,
 check((starts_at is null and ends_at is null) or (starts_at is not null and ends_at is not null and ends_at>starts_at)),
 check(slot_id is not null or (kind in ('extra','additional') and teaching_assignment_id is not null and starts_at is not null)),
 unique(workspace_id,id), foreign key(workspace_id,timetable_version_id) references public.timetable_versions(workspace_id,id),
 foreign key(workspace_id,slot_id,timetable_version_id) references public.timetable_slots(workspace_id,id,timetable_version_id),
 foreign key(workspace_id,teaching_assignment_id) references public.teaching_assignments(workspace_id,id)
);
create unique index timetable_one_exception on public.timetable_exceptions(workspace_id,slot_id,occurs_on) where deleted_at is null;
create index timetable_version_scope on public.timetable_versions(workspace_id,teacher_id,school_year_id,valid_from);
create index timetable_slot_version on public.timetable_slots(workspace_id,timetable_version_id,weekday,starts_at);
create index timetable_exception_day on public.timetable_exceptions(workspace_id,timetable_version_id,occurs_on);

create function private.timetable_access(w uuid,t uuid,writing boolean) returns boolean language sql stable security definer set search_path='' as $$
 select private.member_role(w) in ('owner','admin') or (private.member_role(w)='teacher' and t=auth.uid())
$$;
revoke all on function private.timetable_access(uuid,uuid,boolean) from public,anon;
grant execute on function private.timetable_access(uuid,uuid,boolean) to authenticated;
alter table public.timetable_versions enable row level security;
revoke all on public.timetable_versions from public,anon,authenticated;
grant select,insert,update on public.timetable_versions to authenticated;
create policy timetable_read on public.timetable_versions for select to authenticated using(private.timetable_access(workspace_id,teacher_id,false));
create policy timetable_insert on public.timetable_versions for insert to authenticated with check(created_by=auth.uid() and private.timetable_access(workspace_id,teacher_id,true));
create policy timetable_update on public.timetable_versions for update to authenticated using(private.timetable_access(workspace_id,teacher_id,true)) with check(private.timetable_access(workspace_id,teacher_id,true));
do $$ declare t text; begin foreach t in array array['timetable_slots','timetable_exceptions'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update on public.%I to authenticated',t);
 execute format('create policy timetable_read on public.%I for select to authenticated using(exists(select 1 from public.timetable_versions v where v.workspace_id=%I.workspace_id and v.id=%I.timetable_version_id and private.timetable_access(v.workspace_id,v.teacher_id,false)))',t,t,t);
 execute format('create policy timetable_insert on public.%I for insert to authenticated with check(created_by=auth.uid() and exists(select 1 from public.timetable_versions v where v.workspace_id=%I.workspace_id and v.id=%I.timetable_version_id and v.deleted_at is null and private.timetable_access(v.workspace_id,v.teacher_id,true)))',t,t,t);
 execute format('create policy timetable_update on public.%I for update to authenticated using(exists(select 1 from public.timetable_versions v where v.workspace_id=%I.workspace_id and v.id=%I.timetable_version_id and private.timetable_access(v.workspace_id,v.teacher_id,true))) with check(exists(select 1 from public.timetable_versions v where v.workspace_id=%I.workspace_id and v.id=%I.timetable_version_id and private.timetable_access(v.workspace_id,v.teacher_id,true)))',t,t,t,t,t);
 end loop;
 foreach t in array array['timetable_versions','timetable_slots','timetable_exceptions'] loop
 execute format('create trigger stamp_record before insert or update on public.%I for each row execute function private.stamp_record()',t);
 end loop;end $$;

create function private.validate_timetable() returns trigger language plpgsql security definer set search_path='' as $$
declare v public.timetable_versions; a record; yr public.school_years; s public.timetable_slots; effective_start time; effective_end time; d date;
begin
 if TG_TABLE_NAME='timetable_versions' then
  perform pg_advisory_xact_lock(hashtextextended(new.workspace_id::text||new.teacher_id::text,150));
  select * into yr from public.school_years where workspace_id=new.workspace_id and id=new.school_year_id and deleted_at is null;
  if yr.id is null or new.valid_from<yr.starts_on or coalesce(new.valid_to,new.valid_from)>yr.ends_on then raise exception 'Validità fuori anno scolastico' using errcode='23514';end if;
  if private.member_role(new.workspace_id) is null or not exists(select 1 from public.workspace_members m where m.workspace_id=new.workspace_id and m.user_id=new.teacher_id and m.revoked_at is null and m.role in ('owner','admin','teacher')) then raise exception 'Docente non autorizzato' using errcode='42501';end if;
  if TG_OP='UPDATE' then
   if (new.teacher_id,new.school_year_id) is distinct from (old.teacher_id,old.school_year_id) then raise exception 'Duplica la versione per cambiare anno o docente' using errcode='23514';end if;
   if old.status<>'draft' and (new.name,new.kind,new.valid_from,new.deleted_at) is distinct from (old.name,old.kind,old.valid_from,old.deleted_at) then raise exception 'Crea una nuova versione per conservare lo storico' using errcode='23514';end if;
   if old.status<>'draft' and new.status='draft' then raise exception 'Non riportare in bozza una versione pubblicata' using errcode='23514';end if;
   if old.valid_to is not null and old.status<>'draft' and (new.valid_to is null or new.valid_to>old.valid_to) then raise exception 'Non estendere lo storico pubblicato' using errcode='23514';end if;
   if old.status<>'draft' and new.valid_to is distinct from old.valid_to and (exists(select 1 from public.timetable_exceptions where timetable_version_id=old.id and deleted_at is null and occurs_on>new.valid_to) or exists(select 1 from public.lessons l join public.timetable_slots x on x.workspace_id=l.workspace_id and x.id=l.timetable_occurrence_id where x.timetable_version_id=old.id and l.deleted_at is null and l.timetable_occurs_on>new.valid_to)) then raise exception 'Il periodo escluderebbe dati già registrati' using errcode='23514';end if;
  end if;
  if new.status<>'draft' and new.deleted_at is null then
   if not exists(select 1 from public.timetable_slots where workspace_id=new.workspace_id and timetable_version_id=new.id and deleted_at is null) then raise exception 'Inserisci almeno uno slot prima di attivare' using errcode='23514';end if;
   if exists(select 1 from public.timetable_versions x where x.workspace_id=new.workspace_id and x.teacher_id=new.teacher_id and x.id<>new.id and x.deleted_at is null and x.status<>'draft' and daterange(x.valid_from,coalesce(x.valid_to,(select ends_on from public.school_years where id=x.school_year_id)),'[]') && daterange(new.valid_from,coalesce(new.valid_to,yr.ends_on),'[]')) then raise exception 'Versioni pubblicate sovrapposte: indica la versione precedente da chiudere' using errcode='23P01';end if;
  end if;
  if new.status='archived' and (new.valid_to is null or new.valid_to>=(now() at time zone 'Europe/Rome')::date) then raise exception 'Archivia soltanto periodi terminati' using errcode='23514';end if;
  return new;
 end if;
 select * into v from public.timetable_versions where workspace_id=new.workspace_id and id=new.timetable_version_id and deleted_at is null;
 if v.id is null then raise exception 'Versione inesistente' using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended(v.workspace_id::text||v.teacher_id::text,150));
 select * into v from public.timetable_versions where workspace_id=new.workspace_id and id=new.timetable_version_id and deleted_at is null;
 if v.id is null then raise exception 'Versione rimossa durante il salvataggio' using errcode='40001';end if;
 if TG_OP='UPDATE' and new.timetable_version_id<>old.timetable_version_id then raise exception 'Versione immutabile' using errcode='23514';end if;
 if TG_TABLE_NAME='timetable_slots' then
  if v.status<>'draft' then raise exception 'Slot pubblicato: duplica la versione o crea una variazione giornaliera' using errcode='23514';end if;
  if new.deleted_at is null and exists(select 1 from public.timetable_slots x where x.workspace_id=new.workspace_id and x.timetable_version_id=v.id and x.weekday=new.weekday and x.id<>new.id and x.deleted_at is null and x.starts_at<new.ends_at and x.ends_at>new.starts_at) then raise exception 'Slot del docente sovrapposti' using errcode='23P01';end if;
 else
  if v.status='draft' or new.occurs_on<v.valid_from or new.occurs_on>coalesce(v.valid_to,(select ends_on from public.school_years where id=v.school_year_id)) then raise exception 'Data fuori versione pubblicata' using errcode='23514';end if;
  if new.slot_id is not null then
   select * into s from public.timetable_slots where id=new.slot_id and workspace_id=new.workspace_id and timetable_version_id=v.id and deleted_at is null;
   if s.id is null or s.weekday<>extract(isodow from new.occurs_on) then raise exception 'Slot non previsto in questa giornata' using errcode='23514';end if;
  end if;
  if exists(select 1 from public.lessons l where l.workspace_id=new.workspace_id and l.timetable_occurrence_id=coalesce(new.slot_id,new.id) and l.timetable_occurs_on=new.occurs_on and l.deleted_at is null) then raise exception 'Lezione già registrata: conserva lo storico e modifica la lezione esistente' using errcode='23514';end if;
  effective_start:=case when new.deleted_at is not null then s.starts_at else coalesce(new.starts_at,s.starts_at) end;effective_end:=case when new.deleted_at is not null then s.ends_at else coalesce(new.ends_at,s.ends_at) end;
  if TG_OP='UPDATE' and (new.slot_id,new.occurs_on) is distinct from (old.slot_id,old.occurs_on) then raise exception 'Data e slot immutabili: rimuovi la variazione e creane una nuova' using errcode='23514';end if;
  if ((new.deleted_at is null and new.kind not in ('cancelled','trip')) or (new.deleted_at is not null and new.slot_id is not null)) and exists(
   select 1 from public.timetable_slots x left join public.timetable_exceptions e on e.workspace_id=x.workspace_id and e.slot_id=x.id and e.occurs_on=new.occurs_on and e.deleted_at is null and e.id<>new.id
   where x.workspace_id=new.workspace_id and x.timetable_version_id=v.id and x.weekday=extract(isodow from new.occurs_on) and x.deleted_at is null and x.id is distinct from new.slot_id and coalesce(e.kind,'ordinary') not in ('cancelled','trip') and coalesce(e.starts_at,x.starts_at)<effective_end and coalesce(e.ends_at,x.ends_at)>effective_start
   union all select 1 from public.timetable_exceptions e where e.workspace_id=new.workspace_id and e.timetable_version_id=v.id and e.occurs_on=new.occurs_on and e.slot_id is null and e.deleted_at is null and e.id<>new.id and e.starts_at<effective_end and e.ends_at>effective_start
  ) then raise exception 'Variazione sovrapposta ad altra lezione' using errcode='23P01';end if;
 end if;
 if new.teaching_assignment_id is not null then
  select ta.*,c.school_year_id,cs.subject_id into a from public.teaching_assignments ta join public.classes c on c.workspace_id=ta.workspace_id and c.id=ta.class_id join public.class_subjects cs on cs.workspace_id=ta.workspace_id and cs.id=ta.class_subject_id where ta.workspace_id=new.workspace_id and ta.id=new.teaching_assignment_id and ta.deleted_at is null and c.deleted_at is null and cs.deleted_at is null;
  if a.id is null or a.teacher_id<>v.teacher_id or a.school_year_id<>v.school_year_id then raise exception 'Classe/materia non assegnata al docente e anno selezionati' using errcode='23514';end if;
 end if;
 return new;
end $$;
create function private.validate_timetable_lesson() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.timetable_slots; e public.timetable_exceptions; v public.timetable_versions; assignment uuid; st time; en time;
begin
 if TG_OP='UPDATE' and (new.timetable_occurrence_id,new.timetable_occurs_on) is distinct from (old.timetable_occurrence_id,old.timetable_occurs_on) then raise exception 'Provenienza orario immutabile' using errcode='23514';end if;
 if new.timetable_occurrence_id is null then return new;end if;
 select * into s from public.timetable_slots where workspace_id=new.workspace_id and id=new.timetable_occurrence_id and deleted_at is null;
 if s.id is not null then
  select * into v from public.timetable_versions where workspace_id=s.workspace_id and id=s.timetable_version_id and deleted_at is null;
  select * into e from public.timetable_exceptions where workspace_id=new.workspace_id and slot_id=s.id and occurs_on=new.timetable_occurs_on and deleted_at is null;
  if s.weekday<>extract(isodow from new.timetable_occurs_on) then raise exception 'Giorno non previsto' using errcode='23514';end if;
 else
  select * into e from public.timetable_exceptions where workspace_id=new.workspace_id and id=new.timetable_occurrence_id and slot_id is null and occurs_on=new.timetable_occurs_on and deleted_at is null;
  select * into v from public.timetable_versions where workspace_id=e.workspace_id and id=e.timetable_version_id and deleted_at is null;
 end if;
 if v.id is null or v.status='draft' or new.timetable_occurs_on<v.valid_from or new.timetable_occurs_on>coalesce(v.valid_to,(select ends_on from public.school_years where id=v.school_year_id)) then raise exception 'Provenienza orario non valida' using errcode='23514';end if;
 if TG_OP='INSERT' then
  perform pg_advisory_xact_lock(hashtextextended(v.workspace_id::text||v.teacher_id::text,150));
  if e.kind in ('cancelled','trip') then raise exception 'Lezione annullata' using errcode='23514';end if;
  assignment:=coalesce(e.teaching_assignment_id,s.teaching_assignment_id);st:=coalesce(e.starts_at,s.starts_at);en:=coalesce(e.ends_at,s.ends_at);
  if new.teaching_assignment_id is distinct from assignment or new.starts_at is distinct from ((new.timetable_occurs_on+st) at time zone 'Europe/Rome') or new.ends_at is distinct from ((new.timetable_occurs_on+en) at time zone 'Europe/Rome') then raise exception 'Orario o assegnazione non corrispondenti allo slot' using errcode='23514';end if;
 end if;
 return new;
end $$;
revoke all on function private.validate_timetable_lesson() from public,anon,authenticated;
create trigger validate_timetable_lesson before insert or update on public.lessons for each row execute function private.validate_timetable_lesson();
revoke all on function private.validate_timetable() from public,anon,authenticated;
-- Nullable provenance leaves all existing lesson records untouched.
alter table public.lessons add column timetable_occurrence_id uuid, add column timetable_occurs_on date;
alter table public.lessons add constraint timetable_provenance_pair check((timetable_occurrence_id is null)=(timetable_occurs_on is null));
create unique index lessons_timetable_occurrence on public.lessons(workspace_id,timetable_occurrence_id,timetable_occurs_on) where deleted_at is null and timetable_occurrence_id is not null;
create trigger validate_timetable before insert or update on public.timetable_versions for each row execute function private.validate_timetable();
create trigger validate_timetable before insert or update on public.timetable_slots for each row execute function private.validate_timetable();
create trigger validate_timetable before insert or update on public.timetable_exceptions for each row execute function private.validate_timetable();

create function public.activate_timetable(p_id uuid,p_version bigint,p_previous uuid default null,p_previous_version bigint default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare v public.timetable_versions; prev public.timetable_versions;
begin
 select * into v from public.timetable_versions where id=p_id and deleted_at is null;
 if v.id is null then raise exception 'Versione non autorizzata' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(v.workspace_id::text||v.teacher_id::text,150));
 select * into v from public.timetable_versions where id=p_id and deleted_at is null;
 if v.status='active' and v.version=p_version+1 then return v.id;end if;
 if v.version<>p_version or v.status<>'draft' then raise exception 'Versione cambiata: ricarica' using errcode='40001';end if;
 if p_previous is not null then
  select * into prev from public.timetable_versions where id=p_previous and workspace_id=v.workspace_id and teacher_id=v.teacher_id and school_year_id=v.school_year_id and status='active' and deleted_at is null for update;
  if prev.id is null or prev.version is distinct from p_previous_version or prev.valid_from>=v.valid_from then raise exception 'Versione precedente non valida o cambiata' using errcode='40001';end if;
  if exists(select 1 from public.timetable_exceptions where timetable_version_id=prev.id and deleted_at is null and occurs_on>=v.valid_from) or exists(select 1 from public.lessons l join public.timetable_slots s on s.id=l.timetable_occurrence_id and s.workspace_id=l.workspace_id where s.timetable_version_id=prev.id and l.timetable_occurs_on>=v.valid_from and l.deleted_at is null) then raise exception 'Il nuovo periodo escluderebbe variazioni o lezioni registrate' using errcode='23514';end if;
  update public.timetable_versions set valid_to=v.valid_from-1,version=version+1 where id=prev.id;
 end if;
 update public.timetable_versions set status='active',version=version+1 where id=v.id and version=p_version;
 if not found then raise exception 'Versione cambiata' using errcode='40001';end if;
 return v.id;
end $$;

create function public.duplicate_timetable(p_id uuid,p_name text,p_year uuid,p_teacher uuid,p_map jsonb default '{}'::jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare v public.timetable_versions; nid uuid:=gen_random_uuid(); s public.timetable_slots; yr public.school_years; assignment uuid;
begin
 select * into v from public.timetable_versions where id=p_id and deleted_at is null;
 if v.id is null then raise exception 'Versione non autorizzata' using errcode='42501';end if;
 select * into yr from public.school_years where id=p_year and workspace_id=v.workspace_id and deleted_at is null;
 if yr.id is null then raise exception 'Anno non autorizzato' using errcode='42501';end if;
 insert into public.timetable_versions(id,workspace_id,school_year_id,teacher_id,name,kind,valid_from,valid_to) values(nid,v.workspace_id,p_year,p_teacher,p_name,v.kind,case when p_year=v.school_year_id then v.valid_from else yr.starts_on end,case when p_year=v.school_year_id then v.valid_to else yr.ends_on end);
 for s in select * from public.timetable_slots where workspace_id=v.workspace_id and timetable_version_id=v.id and deleted_at is null loop
  assignment:=case when p_year=v.school_year_id and p_teacher=v.teacher_id then s.teaching_assignment_id else nullif(p_map->>s.teaching_assignment_id::text,'')::uuid end;
  if assignment is null then raise exception 'Conferma ogni assegnazione nel nuovo anno: nessun docente ereditato automaticamente' using errcode='23514';end if;
  insert into public.timetable_slots(workspace_id,timetable_version_id,teaching_assignment_id,weekday,starts_at,ends_at,room,notes,kind) values(v.workspace_id,nid,assignment,s.weekday,s.starts_at,s.ends_at,s.room,s.notes,s.kind);
 end loop;
 return nid;
end $$;

create function public.register_timetable_lesson(p_occurrence uuid,p_day date) returns uuid language plpgsql security invoker set search_path='' as $$
declare s public.timetable_slots; e public.timetable_exceptions; v public.timetable_versions; assignment uuid; st time; en time; existing uuid; occurrence uuid;
begin
 select * into s from public.timetable_slots where id=p_occurrence and deleted_at is null;
 if s.id is not null then
  select * into v from public.timetable_versions where id=s.timetable_version_id and workspace_id=s.workspace_id and deleted_at is null;
  select * into e from public.timetable_exceptions where slot_id=s.id and workspace_id=s.workspace_id and occurs_on=p_day and deleted_at is null;
  if s.weekday<>extract(isodow from p_day) then raise exception 'Giorno non previsto' using errcode='23514';end if;
 else
  select * into e from public.timetable_exceptions where id=p_occurrence and occurs_on=p_day and slot_id is null and deleted_at is null;
  select * into v from public.timetable_versions where id=e.timetable_version_id and workspace_id=e.workspace_id and deleted_at is null;
 end if;
 if v.id is null or v.status='draft' or p_day<v.valid_from or p_day>coalesce(v.valid_to,(select ends_on from public.school_years where id=v.school_year_id)) then raise exception 'Orario non valido o non autorizzato' using errcode='42501';end if;
 if e.kind in ('cancelled','trip') then raise exception 'Lezione annullata: nessuna registrazione' using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended(v.workspace_id::text||v.teacher_id::text,150));
 assignment:=coalesce(e.teaching_assignment_id,s.teaching_assignment_id);st:=coalesce(e.starts_at,s.starts_at);en:=coalesce(e.ends_at,s.ends_at);occurrence:=coalesce(s.id,e.id);
 select id into existing from public.lessons where workspace_id=v.workspace_id and deleted_at is null and ((timetable_occurrence_id=occurrence and timetable_occurs_on=p_day) or (teaching_assignment_id=assignment and starts_at=(p_day+st) at time zone 'Europe/Rome' and ends_at=(p_day+en) at time zone 'Europe/Rome')) order by created_at limit 1;
 if existing is not null then return existing;end if;
 insert into public.lessons(workspace_id,teaching_assignment_id,starts_at,ends_at,title,notes,timetable_occurrence_id,timetable_occurs_on) values(v.workspace_id,assignment,(p_day+st) at time zone 'Europe/Rome',(p_day+en) at time zone 'Europe/Rome','Lezione da orario',coalesce(e.notes,s.notes),occurrence,p_day) returning id into existing;
 return existing;
end $$;
revoke all on function public.activate_timetable(uuid,bigint,uuid,bigint),public.duplicate_timetable(uuid,text,uuid,uuid,jsonb),public.register_timetable_lesson(uuid,date) from public,anon;
grant execute on function public.activate_timetable(uuid,bigint,uuid,bigint),public.duplicate_timetable(uuid,text,uuid,uuid,jsonb),public.register_timetable_lesson(uuid,date) to authenticated;
