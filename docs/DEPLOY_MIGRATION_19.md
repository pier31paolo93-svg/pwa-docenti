# Deploy migrazione 19 — 22 ottobre 2026

## Risultato

Correzione autorizzata applicata esclusivamente a **pwa-docenti**, Project Ref **mwabfmooefmkszlrymyx**. Cronologia finale **19/19**, controlli remoti **35/35 superati**. L'anomalia ACL della migrazione 18 è risolta. Nessun reset, seed, modifica di account/workspace, merge su main o pubblicazione Pages. Nessun push GitHub eseguito in questo intervento.

## Ambito SQL esatto

File: `supabase/migrations/20261022000300_restrict_homework_completion_acl.sql`.

```sql
revoke all on public.v_homework_completion from public,anon,authenticated;
grant select on public.v_homework_completion to authenticated;
```

Revocati i privilegi della sola vista a PUBLIC, anon e authenticated, compreso MAINTAIN di PostgreSQL 17; restituito esclusivamente SELECT ad authenticated. Nessun ALTER/CREATE VIEW, modifica delle policy RLS, DML su tabelle, modifica di default privileges o RPC. I privilegi amministrativi di postgres/service_role rimangono invariati; «solo SELECT» si riferisce al ruolo applicativo authenticated. Le prime 18 migrazioni non sono state riscritte. Il precedente file di proposta è stato promosso nella cartella delle migrazioni attive e rimosso da proposals.

## Identità, preflight e applicazione

1. Elenco progetti CLI e ref locale confermano l'unico progetto collegato pwa-docenti/ref autorizzato.
2. Snapshot in READ ONLY: esattamente 18 versioni remote corrispondenti alle prime 18 locali. Cataloghi pg_class/aclexplode confermano gli eccessi preesistenti di authenticated: DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE, oltre a SELECT.
3. Applicata solo la 19 sullo stack locale esistente, senza reset o seed; eseguiti i test descritti sotto.
4. `supabase db push --linked --dry-run --skip-vault` positivo: soltanto il file 19, `dryRun=true`, seed e ruoli vuoti. Controllo automatico anche sul contenuto: esclusivamente le due istruzioni ACL sopra.
5. Ricontrollato il ref immediatamente prima di `supabase db push --linked --skip-vault --yes`. Applicato soltanto il file 19; seed e ruoli vuoti, esito positivo.
6. Cronologia remota verificata nuovamente e confrontata con tutti i 19 file locali.

## Collaudo locale PostgreSQL 17

| Verifica | Esito |
|---|---|
| Migrazione incrementale sullo stack esistente | Solo 19 applicata; nessun reset/seed |
| pgTAP backend | 69/69 |
| pgTAP frontend | 12/12 |
| Nuovi pgTAP ACL | 8/8 |
| Totale pgTAP | **89/89** |
| Integrazione SQL | **69/69**, transazione annullata |
| Lint public/private | Nessun errore, warning gate superato |
| Smoke fittizio INSERT/UPDATE/import/conflitti/isolamento | Superato sui due workspace locali; ROLLBACK completo |
| Lettura vista con righe fittizie | Owner legge i propri compiti; non vede quelli dell'altro workspace |

Il primo avvio pgTAP non trovava Docker nel PATH; ripetuto con la directory Docker Desktop. Il successivo tentativo standard ha rilevato che l'ambiente locale contiene ulteriori utenti E2E rispetto ai due Owner del seed: l'asserzione globale «esattamente due workspace» falliva. Senza cancellare utenti o ricostruire il database, sono state usate copie locali ignorate dei test backend/SQL, limitando le sole asserzioni di conteggio ai due workspace del seed esistente. Il resto dei test è rimasto identico; test frontend/ACL eseguiti dai file originali. Tutti i 89 pgTAP e 69 SQL sono poi passati. Nessuna anomalia funzionale SQL o cloud emersa. Le copie adattate e i log restano in `.local-test/`.

I test backend modificano record fittizi nella propria transazione e terminano con ROLLBACK; nessuna modifica persistente agli account. Lo smoke esteso usa claim SQL di test, non password/token/login dei due account reali. Non sono state ripetute prove di concorrenza o browser, perché la modifica riguarda esclusivamente ACL della vista; gli esiti precedenti rimangono storici.

## Verifiche remote e invarianti

`scripts/verify-migration19-remote.sql` conserva tutti i 35 controlli introdotti dopo la 18, aggiornando soltanto l'attesa della cronologia a 19. **35/35 superati**: PostgreSQL 17, migrazioni, colonne/vincoli/FK/indice, collegamento di accesso, security invoker e dipendenze della vista, esclusione dei record archiviati, SELECT authenticated e assenza di privilegi aggiuntivi, esclusione anon/PUBLIC, adapter/RPC/PT409, RLS tabelle, validità di vincoli e indici, due utenti/profili/workspace/membership e AI disabilitata.

Snapshot prima/dopo: cambiati esclusivamente cronologia e ACL della nuova vista. Identici hash di auth.users, auth.identities, profili, workspace, membership, dati didattici verificati, policy RLS, ACL/RLS delle tabelle, funzioni preesistenti, viste precedenti, collegamenti di accesso e cronologia precedente. Definizione e opzioni della vista sono identiche. **2 Owner e rispettivi 2 workspace invariati**. I grant postgres/service_role della vista sono identici; authenticated ha soltanto SELECT, PUBLIC/anon nessun grant. Nessuna modifica Auth e nessuna password utilizzata; la configurazione signup non è stata nuovamente interrogata in questo intervento.

`scripts/verify-homework-view-rls.sql` eseguito sul cloud in transazione READ ONLY: SELECT riesce impersonando separatamente i due Owner mediante ruolo authenticated/claim locale; nessuna riga dell'altro workspace è visibile; SELECT anon viene negato. Nessuna scrittura remota o creazione di fixture. Dove mancano dati, un risultato vuoto non dimostra da solo l'isolamento su righe popolate: tale comportamento è stato verificato anche in locale con compiti fittizi in entrambi i workspace, RLS/security invoker e policy remote sono invariati. Non è un test HTTP con credenziali reali.

## Stato finale e limiti

La correzione ACL è completata e non restano anomalie aperte di questa migrazione. I salvataggi cloud con dati fittizi e il login HTTP reale non sono stati eseguiti: non facevano parte dell'autorizzazione di sola correzione dei privilegi. Gli script di collaudo sono pronti, ma eventuali scritture fittizie cloud richiedono autorizzazione separata. Il rilascio frontend/Pages, il collaudo interattivo login/recupero e i dispositivi reali rimangono attività successive.

Report e script non contengono dati personali o segreti. Snapshot e log ignorati da Git non sono inclusi nel commit locale su dev.
