# Preflight deploy Supabase — 22 ottobre 2026
**Documento storico del piano approvato.** Il deploy qui proposto è stato successivamente autorizzato e completato: vedere [DEPLOY_SUPABASE.md](DEPLOY_SUPABASE.md) per lo stato attuale. Le descrizioni e i comandi non ancora eseguiti nelle sezioni seguenti si riferiscono al momento del preflight.

## Esito e arresto prima del deploy
**Preflight completato. Dry-run riuscito; nessuna migrazione applicata al cloud.**
Il pacchetto pronto per l'approvazione contiene **17 migrazioni**: le 16 originali del commit b84c37d, invariate, più una revoca ACL rilevata nell'audit dei permessi.

È richiesta un'autorizzazione esplicita prima di procedere. La registrazione pubblica cloud è attualmente attiva: è stata preparata e confrontata, senza applicarla, una modifica isolata per disattivarla.

## Identità del progetto
| Campo | Verifica effettuata |
|---|---|
| Nome | pwa-docenti |
| Project Ref | mwabfmooefmkszlrymyx |
| Organizzazione ID | dcwciatkaiyttemkttne |
| Regione | eu-west-1, Ireland |
| Stato API | ACTIVE_HEALTHY |
| PostgreSQL remoto | 17.11 |
| PostgreSQL locale collaudato | 17.11 |
| Collegamento locale | supabase/.temp/project-ref verificato uguale al Ref sopra |
| Account CLI | Login ufficiale completato dall'utente; nessun token in documenti o repository |

L'elenco progetti è stato letto per identificare il destinatario. È stato collegato soltanto questo Ref; nessun altro progetto è stato creato, collegato o modificato.

## Audit locale e dipendenze
- 44 tabelle pubbliche, tutte con RLS e quattro policy distinte.
- 10 viste security_invoker; anon senza privilegi sulle tabelle/viste applicative.
- Nessun hard DELETE applicativo per authenticated.
- 23 funzioni applicative; nessun EXECUTE a PUBLIC/anon dopo la correzione.
- Tutti i SECURITY DEFINER con search_path vuoto e controlli di autorizzazione; RPC dati invoker.
- Schema private non esposto dal config API.
- Tutte le dipendenze FK risolte nell'ordine dei file; ricostruzione completa a conferma delle dipendenze runtime.
- scripts/preflight-local.sql: transazione READ ONLY, PASS e rollback.

La funzione trigger private.validate_assessment_completeness() conservava il permesso EXECUTE predefinito di PUBLIC perché creata dopo la revoca generale. È privata e non chiamabile come normale RPC, ma il permesso era superfluo. La nuova migrazione 20261022000100_restrict_trigger_execute.sql revoca EXECUTE a PUBLIC, anon e authenticated. Le 16 migrazioni già pubblicate non sono state riscritte.

## Collaudo del pacchetto aggiornato
Due ricostruzioni locali complete PostgreSQL 17.11, ciascuna con tutte le 17 migrazioni:
- 69/69 pgTAP: 138 esecuzioni nei due cicli.
- 69/69 controlli SQL diretti: 138 esecuzioni degli stessi casi applicativi.
- 2 prove totali di concorrenza reale, secondo writer respinto con 40001 e revisione del primo preservata.
- Lint public/private con --fail-on warning: zero problemi in entrambi i cicli.
- Audit finale di catalogo RLS/privilegi: PASS.

Log locali esclusi da Git: .local-test/predeploy-tests.log e .local-test/predeploy-security.log.

## Seed
Solo dati inventati: UUID di test, email example.invalid, NomeInventato/CognomeInventato e scuole fittizie. Nessun dato reale di studenti e nessun import personale presente.

Il piano non include seed.sql né i dati dei test. Il dry-run riporta seeds=[] e roles=[]; non saranno usati --include-seed o --include-roles.

## Schema remoto e cronologia
Lettura via Supabase CLI/Management API con scripts/preflight-remote.sql, una sola SELECT di metadati e conteggio aggregato, senza righe personali:
- Nessuna tabella, vista o sequenza applicativa in public/private.
- Schema private assente.
- Nessuna policy o trigger applicativo, incluso auth.users.
- Utenti Auth esistenti: 0; nessun backfill iniziale necessario.
- supabase_migrations.schema_migrations assente; nessuna migrazione remota preesistente.
- Unico oggetto public rilevato: funzione predefinita Supabase rls_auto_enable(), return event_trigger, associata all'evento ensure_rls / ddl_command_end. Non collide con gli oggetti delle migrazioni e non viene modificata.

La cronologia CLI elenca tutte le versioni locali e colonna remota vuota. Non sono emersi conflitti di nomi o di cronologia. La presenza dell'event trigger Supabase abilita RLS automaticamente; le nostre policy/abilitazioni esplicite restano necessarie e compatibili.

## Dry-run effettivamente eseguito
```powershell
npx.cmd --no-install supabase db push --linked --dry-run --skip-vault
```
Destinatario verificato prima del comando; processo con PGOPTIONS=-c default_transaction_read_only=on. Exit code 0.

Risposta CLI: dryRun=true, upToDate=false, 17 migrazioni previste, seeds=[], roles=[]. Nessuna migrazione applicata. Nessun Vault o config push eseguito.

Elenco effettivo proposto:
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
17. `20261022000100_restrict_trigger_execute.sql`

Hash SHA-256 in DEPLOY_MANIFEST.json. Dopo il dry-run è stata ripetuta la query di metadati: risultato identico prima/dopo, 0 oggetti applicativi, 0 utenti Auth, cronologia ancora assente.

## Configurazione Auth: rischio confermato e correzione proposta
Il confronto ufficiale readonly config diff ha rilevato:
- auth.enable_signup: remoto true, locale false.
- auth.email.enable_signup: remoto true, locale false.
- auth.site_url: remoto http://localhost:3000, locale http://localhost:5173.

La registrazione pubblica remota non soddisfa il requisito di accesso tramite inviti. Non è stata modificata.

Per evitare di inviare al cloud impostazioni di sviluppo o cambiare altri servizi, è stata preparata una configurazione isolata in deploy/auth-invites-only/supabase/config.toml. Il confronto readonly con il Ref verificato mostra **una sola modifica dichiarata**: auth.enable_signup, da true a false. La disabilitazione globale blocca le nuove registrazioni pubbliche; non viene disabilitato il provider email, necessario per l'accesso degli utenti invitati.

Anteprima verificata:
```powershell
npx.cmd --no-install supabase config diff --workdir deploy/auth-invites-only --project-ref mwabfmooefmkszlrymyx
```
auth.site_url e i redirect rimangono invariati: andranno configurati per la PWA nella fase frontend, che non è iniziata. Non eseguire un config push dalla cartella principale, perché proporrebbe anche impostazioni locali non pertinenti.

## Rischi e limiti residui
- Nessun conflitto rilevato nello stato remoto letto; il dry-run non esegue il DDL ed è una verifica del piano, non una prova completa del deploy remoto.
- Prima del deploy va disattivata la registrazione pubblica, con l'autorizzazione qui richiesta.
- Rileggere identità, cronologia e dry-run immediatamente prima dell'esecuzione se il progetto o i file cambiano.
- La revoca CREATE su public è applicabile allo stato attuale, privo di altre applicazioni; eventuali nuove app nel progetto richiederebbero un nuovo controllo.
- Non sono compresi audit esterno, carico, browser/IndexedDB o login end-to-end via HTTP.

## Operazioni proposte, ancora NON eseguite
Dopo autorizzazione esplicita, nell'ordine:
1. Verificare nuovamente il Ref.
2. Applicare solo la configurazione isolata auth.enable_signup=false:
```powershell
npx.cmd --no-install supabase config push --workdir deploy/auth-invites-only --project-ref mwabfmooefmkszlrymyx
```
3. Verificare che il confronto non proponga più modifiche dichiarate.
4. Ripetere cronologia e dry-run, quindi applicare soltanto le migrazioni:
```powershell
npx.cmd --no-install supabase db push --linked --skip-vault
```
5. Verificare cronologia, oggetti, RLS e privilegi in cloud, senza inserire demo.

Questi comandi sono documentazione del piano da approvare; config push e db push senza --dry-run non sono stati eseguiti.

## Conferma dei limiti rispettati
Nessuna migrazione/seed/DDL applicativo, reset remoto, modifica Auth o configurazione cloud eseguiti. La CLI ha usato la propria procedura ufficiale di inizializzazione del ruolo di login per le connessioni. Lo schema e i metadati applicativi sono stati verificati invariati dopo il dry-run.

Nessun frontend avviato e nessun altro progetto Supabase modificato.
