# Deploy migrazione 18 — 22 ottobre 2026

## Esito e blocco residuo

Applicata esclusivamente `20261022000200_frontend_workflows.sql` al progetto **pwa-docenti**, Project Ref **mwabfmooefmkszlrymyx**. Cronologia finale **18/18**. Il deploy SQL è riuscito; il rilascio operativo resta sospeso per un'anomalia ACL rilevata nei controlli successivi: **34/35 controlli remoti superati**. Nessuna correzione cloud è stata tentata dopo la rilevazione.

Prima del deploy sono stati verificati progetto collegato, ref nella configurazione locale della connessione e corrispondenza esatta delle 17 versioni remote con le prime 17 migrazioni locali. Il file 18 coincideva con il commit `c44bdb6` (normalizzando le terminazioni di riga). Il nuovo dry-run indicava soltanto la 18, zero seed e zero ruoli. Il comando eseguito è stato `supabase db push --linked --skip-vault --yes`; il risultato ha confermato soltanto tale file. Nessun reset, seed, config push o modifica degli account.

## Verifiche remote in sola lettura

Su PostgreSQL 17.11 sono state controllate cronologia, colonne, vincolo di giustificazione, FK composta, indice valido, collegamento di accesso, vista security invoker e dipendenze, permessi vista/RPC, gestione PT409, RLS, vincoli e indici applicativi, due account/profili/workspace e membership Owner, AI disabilitata. Script riproducibile: `scripts/verify-migration18-remote.sql`, con transazione READ ONLY e ROLLBACK. Dopo la prima esecuzione il controllo negativo sulla vista è stato ulteriormente esteso a tutti i privilegi diversi da SELECT; questa versione estesa non è stata rieseguita sul cloud.

Il confronto prima/dopo tramite hash calcolati sul server conferma invariati:

- `auth.users`, `auth.identities`, profili, workspace e membership: **2 Owner e 2 workspace distinti**, stessi record integrali, inclusi i campi Auth; nessun nuovo account.
- Cronologia delle prime 17 migrazioni, funzioni preesistenti, policy RLS, ACL/RLS delle tabelle, viste preesistenti e collegamenti di accesso precedenti.
- Record preesistenti di compiti e verifiche, escludendo dal confronto le sole colonne aggiunte.

Non sono state lette password in chiaro, usate password reali o effettuati login dei due Owner. Nessuna modifica della configurazione Auth in questo intervento; lo stato signup non è stato nuovamente verificato tramite endpoint Auth. Non sono stati inseriti studenti o dati personali. Snapshot e log restano in `.local-test/`, ignorata da Git; il report non include identità, hash sensibili o credenziali.

## Anomalia ACL della nuova vista

`v_homework_completion` eredita dai default privileges dello schema public privilegi aggiuntivi per `authenticated`: INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES e TRIGGER, oltre a SELECT. La migrazione revoca PUBLIC/anon ma il successivo GRANT SELECT non rimuove i privilegi già ereditati da authenticated. PUBLIC e anon risultano esclusi correttamente.

La vista è `security_invoker=true`, non aggiornabile e non inseribile secondo il catalogo, senza trigger utente/INSTEAD OF: non è stata dimostrata una scrittura effettiva tramite questi privilegi. Rimane una violazione del minimo privilegio, da correggere prima del rilascio. I due nuovi adapter RPC sono security invoker, search_path vuoto, EXECUTE disponibile ad authenticated e negato a PUBLIC/anon; delegano alle RPC originali senza modificarle. Nessuna policy RLS è stata alterata.

Proposta minima in `supabase/proposals/20261022000300_restrict_homework_completion_acl.sql`: revocare i privilegi della sola vista a PUBLIC/anon/authenticated e restituire soltanto SELECT ad authenticated. Nessuna modifica a dati, account, funzioni, policy o default privileges globali. **Non applicata sul cloud e non presente nella cartella migrations**: occorre autorizzazione separata per promuoverla a migrazione 19 e applicarla. Non riscrivere la migrazione 18 già registrata.

## Test fittizi preparati e verifica locale

`scripts/test-migration18-writes-rollback.sql` prepara INSERT/UPDATE nei due workspace, ripetizione idempotente, conflitto PT409, motivo obbligatorio della giustificazione, lettura del riepilogo, regola della verifica, import con conflitto e divieti di lettura/scrittura/riferimento tra workspace. Tutti i nuovi dati sono inventati e l'intera sessione termina con ROLLBACK. Gli hash di account, profili, workspace e membership devono restare invariati. Lo script rifiuta l'esecuzione se la discrepanza ACL è ancora presente.

**Verifica locale riuscita** su Docker Supabase: proposta ACL e script sono stati eseguiti nella stessa transazione e annullati insieme con ROLLBACK. La copia locale del test selezionava esplicitamente i due Owner del seed, escludendo gli ulteriori utenti E2E presenti nel solo ambiente locale. Superati tutti gli assert di entrambi i cicli workspace; nessun dato persistito. Questa è una verifica SQL di ruolo/RLS mediante claim sub, non un login HTTP e non un test browser. Non utilizza password, token reali o nuove utenze Auth.

**Nessun test di scrittura eseguito sul cloud**. Dopo l'eventuale autorizzazione della correzione: applicare solo la nuova ACL, ripetere la verifica remota in sola lettura (atteso 35/35), quindi richiedere autorizzazione distinta prima di eseguire il test fittizio remoto. Per login reali e recupero password serve collaudo interattivo dell'utente, senza condividere password; verificare workspace distinto, logout, salvataggio/ricaricamento e assenza dei record dell'altro workspace. Non usare le RPC originali con conflitto 40001 attraverso HTTP: usare gli adapter PT409.

## Repository

Documentazione, controllo remoto, test fittizio e proposta ACL sono preparati nel branch locale `dev`. Nessun push aggiuntivo, merge su main o pubblicazione GitHub Pages effettuato in questo intervento. Il collaudo completo precedente (81 pgTAP, 69 SQL, due prove di concorrenza, lint e test frontend) è storico: non è stato rieseguito né dichiarato come test cloud di questo deploy.
