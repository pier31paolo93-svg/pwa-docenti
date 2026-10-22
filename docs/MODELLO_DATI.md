# Modello dati
## Convenzioni
40 tabelle operative condividono: id UUID PK, workspace_id UUID FK, created_by UUID FK profiles (autore), visibility workspace/private, created_at/updated_at timestamptz, version bigint positiva, deleted_at timestamptz e UNIQUE(workspace_id,id). created_by identifica il docente autore e non è riscrivibile. Le altre 4 tabelle pubbliche sono account/membership e audit. Due tabelle tecniche sono private.

Ogni relazione scolastica qui elencata è una FK composita sullo stesso workspace. Per le combinazioni iscrizione/classe/consegna e risultato/verifica sono aggiunti vincoli multi-colonna più stretti nelle migrazioni. I vincoli di unicità restano attivi sulle righe cancellate logicamente: un retry deve riutilizzare l'UUID o risolvere il record esistente, non ricreare lo stesso elemento.

## Account e audit
| Tabella | Chiave e dati | Comportamento |
|---|---|---|
| profiles | id UUID FK auth.users; display_name, timestamp, version | Profilo personale, creato da trigger |
| workspaces | id UUID; owner_id, name, timestamp, version, deleted_at | Tenant personale o futuro condiviso |
| workspace_members | PK(workspace_id,user_id); role, created_at, revoked_at | Un solo Owner; revoca logica preserva assegnazioni storiche |
| grade_audit_log | id UUID; workspace_id, grade_entry_id, actor_id, operation, old_record/new_record, created_at | Storico append-only server |

## Tabelle operative

### school

**school_years** — Anno scolastico e intervallo date; etichetta unica nel workspace.

Campi e vincoli aggiuntivi:
```sql
label text not null,
starts_on date not null,
ends_on date not null,
check(ends_on>starts_on),
unique(workspace_id,label)
```

**schools** — Scuole nelle quali opera il docente; codice stabile unico.

Campi e vincoli aggiuntivi:
```sql
name text not null,
code text not null,
unique(workspace_id,code)
```

**subjects** — Materie riutilizzabili tra classi e scuole.

Campi e vincoli aggiuntivi:
```sql
name text not null,
code text not null,
unique(workspace_id,code)
```

**classes** — Classe specifica di una scuola in un anno; una nuova annualità è una nuova riga.

Campi e vincoli aggiuntivi:
```sql
school_id uuid not null,
school_year_id uuid not null,
name text not null,
unique(workspace_id,school_id,school_year_id,name)
```

Relazioni: school_id → schools.id; school_year_id → school_years.id (sempre con workspace_id).

**students** — Anagrafica con UUID stabile, codice esterno per import e archived_at.

Campi e vincoli aggiuntivi:
```sql
external_code text not null,
first_name text not null,
last_name text not null,
archived_at timestamptz,
unique(workspace_id,external_code)
```

**enrollments** — Storico iscrizione studente/classe, date e risultato promosso/ripetente/trasferito/ritirato.

Campi e vincoli aggiuntivi:
```sql
student_id uuid not null,
class_id uuid not null,
starts_on date not null,
ends_on date,
outcome text check(outcome in ('promoted','repeating','transferred','withdrawn')),
check(ends_on is null or ends_on>=starts_on),
unique(workspace_id,class_id,student_id),
unique(workspace_id,id,class_id)
```

Relazioni: student_id → students.id; class_id → classes.id (sempre con workspace_id).

**class_subjects** — Materia insegnata in una classe, indipendente dal docente.

Campi e vincoli aggiuntivi:
```sql
class_id uuid not null,
subject_id uuid not null,
unique(workspace_id,class_id,subject_id),
unique(workspace_id,id,class_id)
```

Relazioni: class_id → classes.id; subject_id → subjects.id (sempre con workspace_id).

**teaching_assignments** — Assegnazione della materia/classe a un membro docente; gestione Owner/Admin.

Campi e vincoli aggiuntivi:
```sql
class_subject_id uuid not null,
class_id uuid not null,
teacher_id uuid not null,
unique(workspace_id,class_subject_id,teacher_id),
unique(workspace_id,id,class_id),
foreign key(workspace_id,class_subject_id,class_id) references public.class_subjects(workspace_id,id,class_id),
foreign key(workspace_id,teacher_id) references public.workspace_members(workspace_id,user_id)
```

Relazioni: class_id → classes.id (sempre con workspace_id).

### lessons

**topics** — Argomenti della materia.

Campi e vincoli aggiuntivi:
```sql
subject_id uuid not null,
name text not null,
unique(workspace_id,subject_id,name)
```

Relazioni: subject_id → subjects.id (sempre con workspace_id).

**competencies** — Competenze con codice univoco per materia.

Campi e vincoli aggiuntivi:
```sql
subject_id uuid not null,
code text not null,
description text not null,
unique(workspace_id,subject_id,code)
```

Relazioni: subject_id → subjects.id (sempre con workspace_id).

**lessons** — Lezione con assegnazione, data/ora, titolo, note e stato bozza/confermata.

Campi e vincoli aggiuntivi:
```sql
teaching_assignment_id uuid not null,
starts_at timestamptz not null,
ends_at timestamptz not null,
title text not null,
notes text,
status text not null default 'draft' check(status in ('draft','confirmed')),
check(ends_at>starts_at)
```

Relazioni: teaching_assignment_id → teaching_assignments.id (sempre con workspace_id).

**lesson_topics** — Associazione molti-a-molti lezione/argomento.

Campi e vincoli aggiuntivi:
```sql
lesson_id uuid not null,
topic_id uuid not null,
unique(workspace_id,lesson_id,topic_id)
```

Relazioni: lesson_id → lessons.id; topic_id → topics.id (sempre con workspace_id).

**lesson_activities** — Attività della lezione ordinate per posizione.

Campi e vincoli aggiuntivi:
```sql
lesson_id uuid not null,
description text not null,
position integer not null default 0 check(position>=0)
```

Relazioni: lesson_id → lessons.id (sempre con workspace_id).

### homework

**error_types** — Catalogo tipologie di errore del workspace.

Campi e vincoli aggiuntivi:
```sql
code text not null,
description text not null,
unique(workspace_id,code)
```

**assignments** — Consegna didattica della classe; data assegnazione e scadenza.

Campi e vincoli aggiuntivi:
```sql
teaching_assignment_id uuid not null,
class_id uuid not null,
title text not null,
assigned_on date not null,
due_on date not null,
check(due_on>=assigned_on),
unique(workspace_id,id,class_id),
foreign key(workspace_id,teaching_assignment_id,class_id) references public.teaching_assignments(workspace_id,id,class_id)
```

**assignment_topics** — Argomenti associati alla consegna.

Campi e vincoli aggiuntivi:
```sql
assignment_id uuid not null,
topic_id uuid not null,
unique(workspace_id,assignment_id,topic_id)
```

Relazioni: assignment_id → assignments.id; topic_id → topics.id (sempre con workspace_id).

**assignment_exercises** — Esercizi numerati, unici per consegna.

Campi e vincoli aggiuntivi:
```sql
assignment_id uuid not null,
position integer not null check(position>0),
description text not null,
unique(workspace_id,assignment_id,position),
unique(workspace_id,id,assignment_id)
```

Relazioni: assignment_id → assignments.id (sempre con workspace_id).

**homework_checks** — Controllo individuale per iscrizione e consegna, autonomia/comprensione 1..5, suggerimenti.

Campi e vincoli aggiuntivi:
```sql
assignment_id uuid not null,
enrollment_id uuid not null,
class_id uuid not null,
checked_on date not null,
autonomy smallint check(autonomy between 1 and 5),
understanding smallint check(understanding between 1 and 5),
notes text,
suggestions text,
unique(workspace_id,assignment_id,enrollment_id),
unique(workspace_id,id,assignment_id),
foreign key(workspace_id,assignment_id,class_id) references public.assignments(workspace_id,id,class_id),
foreign key(workspace_id,enrollment_id,class_id) references public.enrollments(workspace_id,id,class_id)
```

**homework_exercise_results** — Esito unico per esercizio/controllo; corretto, errato, parziale o non svolto.

Campi e vincoli aggiuntivi:
```sql
homework_check_id uuid not null,
assignment_id uuid not null,
exercise_id uuid not null,
outcome text not null check(outcome in ('correct','wrong','partial','not_done')),
notes text,
unique(workspace_id,homework_check_id,exercise_id),
foreign key(workspace_id,homework_check_id,assignment_id) references public.homework_checks(workspace_id,id,assignment_id),
foreign key(workspace_id,exercise_id,assignment_id) references public.assignment_exercises(workspace_id,id,assignment_id)
```

**homework_errors** — Tipologie di errore per esito dell'esercizio.

Campi e vincoli aggiuntivi:
```sql
exercise_result_id uuid not null,
error_type_id uuid not null,
unique(workspace_id,exercise_result_id,error_type_id)
```

Relazioni: exercise_result_id → homework_exercise_results.id; error_type_id → error_types.id (sempre con workspace_id).

### observations

**observation_types** — Tipi osservabili; contributo disciplinare esplicitamente configurabile.

Campi e vincoli aggiuntivi:
```sql
code text not null,
description text not null,
disciplinary_default boolean not null default false,
unique(workspace_id,code)
```

**observations** — Osservazione DESCRIPTIVE o GRADED; note, partecipazione, comportamenti, difficoltà e punti di forza.

Campi e vincoli aggiuntivi:
```sql
teaching_assignment_id uuid not null,
class_id uuid not null,
enrollment_id uuid not null,
observation_type_id uuid not null,
observed_on date not null,
mode text not null check(mode in ('DESCRIPTIVE','GRADED')),
notes text,
participation text,
observable_behaviors text,
difficulties text,
strengths text,
unique(workspace_id,id,enrollment_id,teaching_assignment_id),
foreign key(workspace_id,teaching_assignment_id,class_id) references public.teaching_assignments(workspace_id,id,class_id),
foreign key(workspace_id,enrollment_id,class_id) references public.enrollments(workspace_id,id,class_id)
```

Relazioni: observation_type_id → observation_types.id (sempre con workspace_id).

**observation_errors** — Errori riconosciuti nell'osservazione.

Campi e vincoli aggiuntivi:
```sql
observation_id uuid not null,
error_type_id uuid not null,
unique(workspace_id,observation_id,error_type_id)
```

Relazioni: observation_id → observations.id; error_type_id → error_types.id (sempre con workspace_id).

**observation_competencies** — Competenze coinvolte nell'osservazione.

Campi e vincoli aggiuntivi:
```sql
observation_id uuid not null,
competency_id uuid not null,
unique(workspace_id,observation_id,competency_id)
```

Relazioni: observation_id → observations.id; competency_id → competencies.id (sempre con workspace_id).

**observation_topics** — Argomenti coinvolti nell'osservazione.

Campi e vincoli aggiuntivi:
```sql
observation_id uuid not null,
topic_id uuid not null,
unique(workspace_id,observation_id,topic_id)
```

Relazioni: observation_id → observations.id; topic_id → topics.id (sempre con workspace_id).

### assessments

**assessment_rubrics** — Rubrica didattica modificabile; lo storico usa snapshot nei risultati.

Campi e vincoli aggiuntivi:
```sql
name text not null,
description text
```

**rubric_criteria** — Criteri con peso, massimo e livelli JSON.

Campi e vincoli aggiuntivi:
```sql
rubric_id uuid not null,
label text not null,
weight numeric not null check(weight>0),
max_score numeric not null check(max_score>0),
levels jsonb not null check(jsonb_typeof(levels)='array')
```

Relazioni: rubric_id → assessment_rubrics.id (sempre con workspace_id).

**assessments** — Verifica scritta, orale, pratica o esercitazione; modalità rapida, analitica o rubrica.

Campi e vincoli aggiuntivi:
```sql
teaching_assignment_id uuid not null,
class_id uuid not null,
title text not null,
assessed_on date not null,
kind text not null check(kind in ('written','oral','practical','graded_exercise')),
correction_mode text not null check(correction_mode in ('quick','analytic','rubric')),
rubric_id uuid,
unique(workspace_id,id,class_id),
unique(workspace_id,id,teaching_assignment_id),
foreign key(workspace_id,teaching_assignment_id,class_id) references public.teaching_assignments(workspace_id,id,class_id)
```

Relazioni: rubric_id → assessment_rubrics.id (sempre con workspace_id).

**assessment_questions** — Quesiti e sottoquesiti, punteggio massimo, argomento e competenza.

Campi e vincoli aggiuntivi:
```sql
assessment_id uuid not null,
parent_question_id uuid,
label text not null,
max_score numeric not null check(max_score>0),
competency_id uuid,
topic_id uuid,
unique(workspace_id,id,assessment_id),
foreign key(workspace_id,parent_question_id,assessment_id) references public.assessment_questions(workspace_id,id,assessment_id),
check(parent_question_id is null or parent_question_id<>id)
```

Relazioni: assessment_id → assessments.id; competency_id → competencies.id; topic_id → topics.id (sempre con workspace_id).

**assessment_results** — Risultato studente/prova, vincolato a iscrizione e assegnazione coerenti.

Campi e vincoli aggiuntivi:
```sql
assessment_id uuid not null,
teaching_assignment_id uuid not null,
class_id uuid not null,
enrollment_id uuid not null,
notes text,
unique(workspace_id,assessment_id,enrollment_id),
unique(workspace_id,id,enrollment_id,teaching_assignment_id),
unique(workspace_id,id,assessment_id),
foreign key(workspace_id,assessment_id,class_id) references public.assessments(workspace_id,id,class_id),
foreign key(workspace_id,assessment_id,teaching_assignment_id) references public.assessments(workspace_id,id,teaching_assignment_id),
foreign key(workspace_id,enrollment_id,class_id) references public.enrollments(workspace_id,id,class_id)
```

**question_results** — Punteggio o correzione rapida per quesito; massimo archiviato e immutabile.

Campi e vincoli aggiuntivi:
```sql
assessment_result_id uuid not null,
assessment_id uuid not null,
question_id uuid not null,
score numeric check(score>=0),
quick_result text check(quick_result in ('good','partial','poor','unanswered')),
notes text,
max_score_snapshot numeric not null check(max_score_snapshot>0),
check(score<=max_score_snapshot),
unique(workspace_id,assessment_result_id,question_id),
foreign key(workspace_id,assessment_result_id,assessment_id) references public.assessment_results(workspace_id,id,assessment_id),
foreign key(workspace_id,question_id,assessment_id) references public.assessment_questions(workspace_id,id,assessment_id)
```

**question_errors** — Tipologie di errore per quesito corretto.

Campi e vincoli aggiuntivi:
```sql
question_result_id uuid not null,
error_type_id uuid not null,
unique(workspace_id,question_result_id,error_type_id)
```

Relazioni: question_result_id → question_results.id; error_type_id → error_types.id (sempre con workspace_id).

**rubric_scores** — Punteggio di criterio con snapshot etichetta, livelli, massimo e peso.

Campi e vincoli aggiuntivi:
```sql
assessment_result_id uuid not null,
criterion_id uuid not null,
criterion_label_snapshot text not null,
levels_snapshot jsonb not null,
max_score_snapshot numeric not null check(max_score_snapshot>0),
weight_snapshot numeric not null check(weight_snapshot>0),
score numeric not null check(score>=0 and score<=max_score_snapshot),
unique(workspace_id,assessment_result_id,criterion_id)
```

Relazioni: assessment_result_id → assessment_results.id; criterion_id → rubric_criteria.id (sempre con workspace_id).

### evaluation

**evaluation_categories** — Categorie separate per scritto, orale, pratico, osservazione, compiti; partecipazione alla media.

Campi e vincoli aggiuntivi:
```sql
code text not null,
name text not null,
contributes_to_average boolean not null default true,
unique(workspace_id,code)
```

**evaluation_rules** — Scala min/max, arrotondamento e conversione monotona non lineare.

Campi e vincoli aggiuntivi:
```sql
name text not null,
minimum numeric not null,
maximum numeric not null,
rounding_step numeric not null default 0.01 check(rounding_step>0),
conversion_points jsonb not null default '[[0,0],[1,1]]' check(jsonb_typeof(conversion_points)='array'),
check(maximum>minimum)
```

**grade_entries** — Registro unico dei voti, suggerimento, conferma, peso, origine, esclusioni e snapshot.

Campi e vincoli aggiuntivi:
```sql
enrollment_id uuid not null,
teaching_assignment_id uuid not null,
class_id uuid not null,
category_id uuid not null,
rule_id uuid not null,
graded_on date not null,
suggested_value numeric,
confirmed_value numeric,
weight numeric not null default 1 check(weight>0),
origin text not null check(origin in ('assessment','observation','homework','manual')),
assessment_result_id uuid,
observation_id uuid,
homework_check_id uuid,
status text not null default 'draft' check(status in ('draft','confirmed','cancelled')),
excluded_from_average boolean not null default false,
allow_behavior_in_average boolean not null default false,
change_reason text,
calculation_snapshot jsonb not null default '{}',
check(status<>'confirmed' or confirmed_value is not null),
check((origin='assessment' and assessment_result_id is not null and observation_id is null and homework_check_id is null) or (origin='observation' and observation_id is not null and assessment_result_id is null and homework_check_id is null) or (origin='homework' and homework_check_id is not null and assessment_result_id is null and observation_id is null) or (origin='manual' and assessment_result_id is null and observation_id is null and homework_check_id is null)),
foreign key(workspace_id,enrollment_id,class_id) references public.enrollments(workspace_id,id,class_id),
foreign key(workspace_id,teaching_assignment_id,class_id) references public.teaching_assignments(workspace_id,id,class_id),
foreign key(workspace_id,assessment_result_id,enrollment_id,teaching_assignment_id) references public.assessment_results(workspace_id,id,enrollment_id,teaching_assignment_id),
foreign key(workspace_id,observation_id,enrollment_id,teaching_assignment_id) references public.observations(workspace_id,id,enrollment_id,teaching_assignment_id)
```

Relazioni: category_id → evaluation_categories.id; rule_id → evaluation_rules.id; homework_check_id → homework_checks.id (sempre con workspace_id).

### offline_ai

**ai_workspace_settings** — Impostazioni AI; enabled vincolato a false in fase 1.

Campi e vincoli aggiuntivi:
```sql
enabled boolean not null default false check(enabled=false),
policy_version text not null default 'phase1-disabled',
unique(workspace_id)
```

**ai_requests** — Tipi di richieste future, senza prompt o dati personali; sempre disabled.

Campi e vincoli aggiuntivi:
```sql
kind text not null check(kind in ('teaching_suggestion','exercise','recovery_plan','aggregate_errors')),
status text not null default 'disabled' check(status='disabled'),
contract_version integer not null default 1 check(contract_version=1)
```

**import_batches** — Batch studenti/iscrizioni con stato preview/applied/rejected.

Campi e vincoli aggiuntivi:
```sql
kind text not null check(kind in ('students','enrollments')),
status text not null default 'preview' check(status in ('preview','applied','rejected')),
unique(workspace_id,id,kind)
```

**import_rows** — Righe normalizzate, errori di validazione, duplicato individuato e scelta insert/skip/reject.

Campi e vincoli aggiuntivi:
```sql
batch_id uuid not null,
row_number integer not null check(row_number>0),
payload jsonb not null,
validation_errors jsonb not null default '[]',
duplicate_of uuid,
resolution text not null default 'pending' check(resolution in ('pending','skip','insert','reject')),
unique(workspace_id,batch_id,row_number)
```

Relazioni: batch_id → import_batches.id; duplicate_of → students.id (sempre con workspace_id).

## Tabelle private
- private.access_links: PK(table_name,column_name); parent_table. Catalogo non scrivibile dal client per autorizzazioni ricorsive.
- private.sync_operations: PK(actor_id,operation_id), workspace_id, table_name, record_id, request_hash, response, created_at. Esiti idempotenti, con RLS per attore; nessun aggiornamento client.

## Migrazioni e dipendenze
Applicare tutti i file nell'ordine lessicografico; ogni file dipende dai precedenti:
1. `20261021000100_accounts.sql`
2. `20261021000200_school.sql`
3. `20261021000300_lessons.sql`
4. `20261021000400_homework.sql`
5. `20261021000500_observations.sql`
6. `20261021000600_assessments.sql`
7. `20261021000700_evaluation.sql`
8. `20261021000800_offline_ai.sql`
9. `20261021000900_security.sql`
10. `20261021001000_grading.sql`
11. `20261021001100_sync_import.sql`
12. `20261021001200_views.sql`
13. `20261021001300_integrity.sql`
14. `20261021001400_assignment_authorization.sql`
15. `20261021001500_domain_guards.sql`
16. `20261021001600_membership_revocation.sql`

La policy ricorsiva viene definita prima dell'helper per assegnazioni; PostgreSQL risolve il corpo PL/pgSQL al runtime. Tutti gli helper sono disponibili prima del seed o dell'utilizzo client.

### Aggiornamento preflight del 22 ottobre 2026
La migrazione aggiuntiva `20261022000100_restrict_trigger_execute.sql` revoca l'EXECUTE superfluo sulla funzione trigger privata di completezza delle verifiche. Le 16 migrazioni precedenti restano invariate; il pacchetto corrente comprende 17 file, ricollaudati localmente. Piano remoto e autorizzazione in [PREDEPLOY_SUPABASE.md](PREDEPLOY_SUPABASE.md).

## Viste e RPC
| Oggetto | Uso |
|---|---|
| v_grade_register | Registro con studente, materia, anno e flag included_in_average |
| v_student_averages | Medie pesate per studente/materia/categoria/anno |
| v_grade_progression | Serie giornaliera dei voti disciplinari |
| v_homework_summary | Conteggi esercizi e percentuale svolgimento |
| v_observation_history | Osservazioni qualitative e valutate dello studente |
| v_assessment_history | Storico verifiche con studente e data |
| v_recurring_errors | Frequenze errori di compiti, osservazioni e verifiche |
| v_competency_progress | Evidenze analitiche per competenza; ratio medio e numerosità |
| v_class_dashboard | Aggregati classe/materia/anno |
| v_subject_dashboard | Aggregati materia/anno |
| student_average | Media con periodo inclusivo, materia, categoria e anno opzionali |
| propose_grade | Conversione pura da ratio 0..1; nessuna conferma automatica |
| sync_mutation | Singola mutazione idempotente con confronto versione |
| preview_import | Validazione/anteprima studenti o iscrizioni, massimo 1000 righe |
| apply_import | Applicazione atomica delle scelte del batch con versione |
| set_workspace_member | Owner assegna Admin/Teacher/Viewer a un utente esistente |
| remove_workspace_member | Owner revoca appartenenza senza cancellare storico |

Le viste sono disponibili come sorgenti di esportazione tramite API Supabase con JWT utente; non c'è un endpoint di esportazione privilegiato. v_competency_progress usa punteggi analitici; osservazioni qualitative si consultano attraverso observation_competencies e v_observation_history, senza convertirle automaticamente in voti.

## Import CSV / Excel
Il contratto backend riceve righe JSON normalizzate. L'adattatore CSV/XLSX della futura applicazione dovrà convertire stringhe/date prima della preview; nessuna interfaccia né parser binario Excel è implementato in questa fase.

Studenti: external_code, first_name, last_name. Iscrizioni: student_id UUID, class_id UUID, starts_on ISO YYYY-MM-DD. I nomi non sono mai la chiave di deduplica. Codici case-sensitive; il chiamante deve definire una convenzione stabile e rimuovere spazi esterni prima dell'invio.

preview_import restituisce batch UUID, crea import_rows con validation_errors e duplicate_of. Il docente consulta l'anteprima con RLS e risolve ogni riga: insert per valide, skip o reject per le altre. Per modificare una riga sorgente errata preparare una nuova preview. apply_import(batch,expected_version) applica tutto in una transazione: se una FK/unicità è diventata non valida, nessun inserimento parziale. L'applicazione è ripetibile sul batch già applicato senza duplicazioni (usare la versione corrente). I vincoli finali del database sono sempre autoritativi.

I controlli massivi sui compiti sono record homework_checks per ogni iscrizione della classe; ogni esercizio ha un solo risultato. La sincronizzazione usa una operation_id per singola riga. Un elenco non svolto non richiede contatori manuali: gli esercizi senza risultato vengono contati in not_done.

## Limiti espliciti
I livelli di rubrica sono JSON per mantenere flessibilità; l'UI futura dovrà presentare livelli coerenti con il criterio. Le catene di sottoquesiti hanno profondità di autorizzazione limitata a 20; punteggi soltanto sulle foglie. Non trasformare un quesito già corretto in un contenitore senza riconciliare la prova e le valutazioni.

Il registro non separa periodi in una tabella autonoma: trimestre/quadrimestre sono intervalli data passati alla RPC. Visibilità è workspace/private e resta stabile per la vita della riga. L'eventuale pubblicazione agli studenti non è prevista in fase 1.
