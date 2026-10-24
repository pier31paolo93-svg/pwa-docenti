# Quaderno Docenti — preflight di attivazione V1.2–V1.4

Verifica del 24 ottobre 2026. **Nessuna migrazione cloud applicata, nessun reset, seed o cancellazione.** I controlli SQL applicativi sono stati eseguiti in transazioni `READ ONLY`, concluse con rollback; i cambi di ruolo/JWT sono esclusivamente di sessione e non modificano account o membership.

## Esito

Progetto verificato tramite elenco progetti e collegamento CLI: **pwa-docenti**, Ref **mwabfmooefmkszlrymyx**, `ACTIVE_HEALTHY`, PostgreSQL **17.11**. La CLI locale è **2.121.0**, invocata direttamente dal pacchetto del repository, senza aggiornamenti.

`origin/main` è `3f07c20`, merge della PR #3. I file delle migrazioni e la configurazione delle capacità frontend coincidono con `dev` `1f0e797`. Repository: **26 migrazioni**. Cloud: **esattamente le prime 20**, senza versioni estranee o buchi nella sequenza applicata.

**Il deploy non è ancora autorizzabile come operazione con recupero verificato:** l'inventario backup non conferma un punto ripristinabile. Va inoltre autorizzato esplicitamente l'aggiornamento previsto delle 24 iscrizioni nella migrazione 21.

## Tutte le migrazioni mancanti, nell'ordine corretto

| N. | File | Effetto e dipendenze |
| --- | --- | --- |
| 21 | `20261023000100_register_numbers.sql` | Aggiunge numero di registro positivo/univoco nella classe, indice e trigger di numerazione/protezione dello storico; estende gli esiti con `pending`. **Assegna numeri alle iscrizioni attive già presenti**, incrementandone versione e timestamp. Base numerazione per passaggio anno e import. |
| 22 | `20261023000200_year_transition.sql` | Crea `year_transitions`, audit dell'operazione e RPC di anteprima/applicazione con controlli Owner/Admin, versioni, vincoli, idempotenza e workspace. Usa i numeri di registro della 21. Non esegue un passaggio anno durante il deploy. |
| 23 | `20261023000300_universal_grids.sql` | Estende rubriche, verifiche, quesiti, risultati e regole con definizione/snapshot griglia, dettagli dei criteri e conversioni. Crea validatori e `create_grid_assessment`; aggiorna il validatore voti conservando il percorso legacy. Non crea verifiche o voti al deploy. |
| 24 | `20261023000400_daily_recovery_audit.sql` | Stato compiti giornaliero, presenza/assenza, vista completamento; tabelle recupero e assegnazioni, RLS/FK/indici; audit studenti/iscrizioni e annullamento controllato. Estende la whitelist della RPC canonica `sync_mutation`, già disponibile dalla 11/18. |
| 25 | `20261023000500_daily_links_advanced_import.sql` | Collega osservazioni a lezioni reali, vincolo di data Europe/Rome e unicità; fingerprint/report batch; RPC di anteprima/import atomico Owner/Admin. Richiede le basi precedenti, in particolare numerazione e modello giornaliero. Non importa persone al deploy. |
| 26 | `20261023000600_attendance_guards.sql` | Impedisce pubblicazione per assenti e modifica ad assente con voto ancora confermato. Mantiene coerenti Compiti e Registro rapido: una successiva correzione dettagliata rimuove il riepilogo giornaliero opzionale e incrementa la versione del controllo. Richiede 24 e il percorso voti/griglie precedente. |

Non basta applicare soltanto 24–25. La sequenza approvabile è **21 → 22 → 23 → 24 → 25 → 26**, senza riapplicare 1–20, saltare file o riscrivere la cronologia.

## Preflight e dry-run effettivamente eseguiti

- Lettura cronologia tramite cataloghi e `migration list --linked --project-ref mwabfmooefmkszlrymyx`.
- `db push --linked --project-ref mwabfmooefmkszlrymyx --dry-run --skip-vault`: **successo**, elenco esatto dei sei file sopra; `dryRun=true`, `seeds=[]`, `roles=[]`. Nessun aggiornamento Vault.
- Nessuna collisione rilevata con i nuovi nomi espliciti di tabelle, colonne, funzioni, indici e trigger. Il token della whitelist atteso dalla migrazione 24 è presente nella definizione remota della RPC canonica.
- Zero iscrizioni orfane, associazioni classe/studente duplicate, esiti incompatibili, date di iscrizione non valide, vincoli non validati, indici invalidi o collegamenti di autorizzazione duplicati. Classe attiva più numerosa: 23 iscrizioni.
- Le colonne che attivano numerazione, griglie, registro rapido e import avanzato sono effettivamente assenti; non si tratta di un errore di login del frontend.

Il dry-run verifica pianificazione e cronologia; **non esegue né certifica tutti i DDL, i trigger o il backfill sui dati di produzione**. Una prova completa richiede una copia ripristinata in ambiente isolato, dopo verifica del backup e autorizzazione per quell'ambiente.

## RLS e isolamento

- **44/44 tabelle pubbliche** con RLS; **11/11 viste** `security_invoker`; nessuna relazione pubblica leggibile dal ruolo anonimo.
- Letture aggregate sotto entrambe le identità Owner esistenti su tutte le 53 relazioni pubbliche dotate di `workspace_id`: nessuna riga di workspace non autorizzati. Nessun nome, email o dato studente restituito nei risultati del test.
- Profilo limitato all'utente corrente e assenza di identità senza accesso agli studenti.
- Directory docenti: **14/14 verifiche di catalogo** e prove runtime superate, inclusa negazione di chiamate fuori workspace. Vista compiti: lettura per entrambi gli Owner, isolamento e negazione anonima superati; ACL SELECT-only per authenticated preservate.
- Nel cloud esistono soltanto due membership Owner. Non sono stati creati Admin, Teacher, Viewer o account di prova. Le verifiche dinamiche di quei ruoli sui nuovi oggetti non possono essere dichiarate eseguite qui; sono coperte dai test precedenti locali/CI e andranno ricontrollate dopo l'attivazione, senza alterare le membership reali.
- Nuovi oggetti: RLS basata su `private.allowed`, FK composite per workspace/classe, grant client limitati, trigger con `search_path` vuoto; RPC import Owner/Admin, passaggio anno con gate espliciti, annullamento invoker/versionato. Gli helper definer hanno scopo ristretto e EXECUTE client revocato dove previsto. Nessuna apertura anonima o interrogazione frontend di `auth.users`.
- `private.access_links` è una tabella tecnica di configurazione delle autorizzazioni, non una tabella pubblica con dati degli studenti; l'assenza di RLS su questa relazione non costituisce un'eccezione al controllo delle 44 tabelle pubbliche.

## Dati esistenti: stato attuale ed effetti previsti

| Oggetto | Prima e dopo il preflight |
| --- | --- |
| Account Auth / profili | 2 / 2, impronte invariate |
| Workspace / membership | 2 / 2, impronte invariate |
| Studenti | 25, impronta invariata |
| Classi | 4, impronta invariata |
| Iscrizioni | 24 totali, tutte attive, impronta invariata |

Sono state confrontate anche identità Auth e impronta dei campi di dominio delle iscrizioni. Nessun dato personale è stato esportato per queste verifiche; sono stati restituiti soltanto conteggi e impronte aggregate, mantenute nell'area locale ignorata da Git.

**Distinzione necessaria per l'autorizzazione futura:** durante questo preflight tutti i dati sono rimasti invariati. Applicando le migrazioni, invece, la **21 aggiornerà le 24 iscrizioni attive**, aggiungendo numeri deterministici per cognome/nome/UUID all'interno della classe e modificando `version`/`updated_at`. Studente, classe, date, esito e identità dell'iscrizione non devono cambiare. Se è richiesta l'invarianza assoluta di ogni campo delle iscrizioni, i file attuali non soddisfano quel vincolo e **non vanno applicati così**.

Le nuove colonne introducono inoltre default derivati nelle righe preesistenti, ad esempio presenza `present`, posizione quesito e modalità conversione `curve`; non correggono automaticamente voti o anagrafiche. I nuovi trigger cambiano controlli sulle scritture future. La numerazione potrà cambiare l'ordine visualizzato nelle classi: prima dell'attivazione è opportuno confermare che l'ordinamento deterministico previsto corrisponda al registro desiderato.

## Backup: recuperabilità non ancora confermata

Comando eseguito in sola lettura:

```powershell
node node_modules/supabase/dist/supabase.js backups list --project-ref mwabfmooefmkszlrymyx --output json
```

Risposta: `walg_enabled=true`, `pitr_enabled=false`, `backups=null`, `physical_backup_data={}`. Non sono stati restituiti backup completati o date minima/massima di ripristino. L'abilitazione WAL-G **non dimostra** da sola la presenza di un backup utilizzabile. Nessuna prova di ripristino è stata eseguita. Storage attuale: 0 bucket, 0 oggetti.

**Condizione preliminare al deploy:** verificare nel [Dashboard Backups del progetto](https://supabase.com/dashboard/project/mwabfmooefmkszlrymyx/database/backups) un punto effettivamente ripristinabile antecedente al deploy, oppure predisporre un backup completo conservato in un percorso sicuro fuori dal repository e provarne il ripristino in un database isolato. Documentare identificativo, orario, hash se esportato, perimetro e risultato della prova. Non attivare servizi a pagamento né avviare restore sul progetto di produzione senza autorizzazione separata.

Un export JSON dell'app o un dump predefinito delle sole tabelle applicative **non basta** a garantire il recupero completo: vanno coperti almeno schema, dati, Auth/identità, membership, grant/funzioni/policy e cronologia migrazioni, oltre alla configurazione necessaria a ripristinare il servizio. Eventuali file Storage futuri richiedono copertura separata. I backup Supabase non comprendono i file Storage e il ripristino richiede indisponibilità temporanea; vedi [documentazione ufficiale backup](https://supabase.com/docs/guides/platform/backups) e [inventario Management API](https://supabase.com/docs/reference/api/v1-list-all-backups).

## Piano di applicazione dopo nuova autorizzazione

1. Confermare backup recuperabile e autorizzare anche il backfill delle 24 iscrizioni; definire una finestra senza nuove modifiche della docente e con code offline già sincronizzate. Non svuotare lo storage della PWA.
2. Usare l'albero di migrazioni verificato, uguale al `main` pubblicato. Ricontrollare Ref, stato del progetto e cronologia; rifare impronte e dry-run immediatamente prima del deploy. Se l'elenco differisce dai sei file previsti, fermarsi.
3. Dopo autorizzazione esplicita, usare il comando di applicazione sotto, senza flag seed/roles/include-all/yes. Conservare log e tempi. Non presumere che l'intero gruppo di sei file sia una sola transazione.
4. Verificare **26/26**, oggetti e ACL/RLS. Confrontare account, identità, membership, studenti e classi con le impronte precedenti; per le iscrizioni confrontare anche l'impronta che esclude soltanto `register_number`, `version`, `updated_at`, e verificare numero/ID/unicità/numero di righe. Controllare che voti e collegamenti storici non siano alterati.
5. Testare letture e nuove RPC, poi scritture con dati interamente fittizi in transazioni con rollback, senza password degli account reali e senza creare utenti. Verificare registro rapido, griglie, import, recupero, storico, calendario e isolamento. Nessun seed.
6. Ricaricare la PWA online: le capacità sono memorizzate in cache per 5 minuti. Il reload deve rivelare le nuove funzioni; nessuna pulizia della copia locale con operazioni pendenti. Confermare login/logout e salvataggi soltanto dopo i controlli SQL.

```powershell
# PREPARAZIONE / LETTURA: già consentite
$expectedRef = 'mwabfmooefmkszlrymyx'
if ((Get-Content -LiteralPath '.\supabase\.temp\project-ref' -Raw).Trim() -ne $expectedRef) {
    throw 'Project Ref diverso da quello autorizzato'
}
node .\node_modules\supabase\dist\supabase.js migration list --linked --project-ref $expectedRef
node .\node_modules\supabase\dist\supabase.js db push --linked --project-ref $expectedRef --dry-run --skip-vault

# SOLO DOPO NUOVA AUTORIZZAZIONE ESPLICITA E BACKUP RECUPERABILE VERIFICATO:
# Il comando seguente NON è stato eseguito durante questo preflight.
node .\node_modules\supabase\dist\supabase.js db push --linked --project-ref $expectedRef --skip-vault

# Controllo successivo dell'intera cronologia:
node .\node_modules\supabase\dist\supabase.js migration list --linked --project-ref $expectedRef
```

L'invocazione diretta usa la CLI 2.121.0 fissata nel repository. È equivalente al comando `npx.cmd --no-install supabase ...`; nessun token o password deve essere inserito nei file, nel comando o in chat. Fermarsi a qualsiasi richiesta di operazione distruttiva o discrepanza.

## Piano di rollback / gestione errori

- **Prima di applicare:** salvare snapshot di schema, definizioni sostituite (`private.validate_grade`, `public.sync_mutation`, vista compiti), baseline delle iscrizioni e backup recuperabile. La semplice impronta permette confronti, ma non ricostruisce i record e non sostituisce il backup.
- **Errore durante il push:** fermarsi, rileggere cronologia e schema per individuare l'ultimo file realmente applicato. Non usare `reset`, seed, `migration repair`, eliminazione della cronologia o riapplicazione alla cieca. Conservare eventuali file già riusciti e predisporre una correzione incrementale da autorizzare.
- **Problema dopo deploy senza perdita di dati:** sospendere l'uso dei moduli interessati e preferire una migrazione compensativa che preservi record nuovi, numeri di registro, audit e storico. Eventuale versione frontend di contenimento richiede approvazione e verifica della compatibilità con il database aggiornato.
- **Ripristino completo necessario:** solo dopo ulteriore autorizzazione, usare il backup verificato e la procedura provata, con indisponibilità pianificata. Le modifiche successive al punto di recupero possono andare perse: definire RPO/RTO sulla base del backup reale, non inventarli. Ripetere i controlli di dati, Auth, permessi e migrazioni prima della riapertura.
- **Nessun down distruttivo automatico:** eliminare tabelle/colonne delle nuove funzioni dopo l'utilizzo potrebbe cancellare dati e rendere incoerenti audit e iscrizioni. Non è una procedura ammessa in questo piano.

## Copertura funzionale e limiti della verifica

| Funzione | Supporto richiesto |
| --- | --- |
| Numeri e ordinamento registro | 21 |
| Passaggio anno e storico relativo | 21–22 |
| Griglie, snapshot, conversioni e correzione | 23, più protezioni assenza 24/26 |
| Registro rapido, partecipazione e note per lezione | 24–25; 26 per coerenza col dettaglio compiti |
| Scheda studente, analisi e calendario | Tabelle canoniche esistenti + 21–26 per le nuove sezioni; nessuna tabella calendario parallela |
| Recupero e assegnazioni | 24, modello di autorizzazione esistente |
| Storico anagrafiche/iscrizioni e annullamento | 24; audit voti esistente e passaggi 22 |
| Import CSV/XLSX avanzato | 21 e 25, con tutti i prerequisiti precedenti |
| Sincronizzazione nuovi record | RPC 11/18 esistente, estensione whitelist 24 e nuove colonne 25 |
| Export workspace | Permessi esistenti e nuove tabelle 22/24/25 |

Il pacchetto 21–26 fornisce gli oggetti necessari alle funzioni V1.2–V1.4 presenti nel codice pubblicato. Il messaggio del Registro rapido è coerente con l'assenza dello schema, non richiede nuovi account o service_role nel frontend. Il deploy non crea automaticamente lezioni, attività, valutazioni o importazioni.

In questo preflight **non sono stati rieseguiti i test locali**: Docker Desktop non era raggiungibile, e non è stato avviato uno stack che potesse eseguire seed. Si conservano come evidenza precedente i 192 pgTAP, 69 SQL, 76 unit test, 33 E2E e la CI verde sullo stesso codice; non sono test remoti delle sei migrazioni ancora assenti. Una prova completa sui dati cloud e un test di recupero restano condizioni esplicite del piano, non risultati già ottenuti.

Le evidenze di dettaglio, senza esportazione delle righe personali, sono in `.local-test/activation-*.json`, `.sql` e `.log`, ignorati da Git. Nessun commit, push o cambiamento dell'applicazione è necessario per questo report. **Attendere autorizzazione; non applicare ancora.**
