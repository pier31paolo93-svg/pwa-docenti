# Fase 2 — report tecnico frontend

> Aggiornamento dopo la correzione autorizzata: **19/19 migrazioni, 35/35 controlli remoti, 89/89 pgTAP locali**. Anomalia ACL della vista risolta; account/workspace invariati. [Report migrazione 19](DEPLOY_MIGRATION_19.md). Le precedenti indicazioni di blocco ACL descrivono lo stato storico dopo la 18.


> Aggiornamento successivo alla fase di sviluppo: commit frontend `c44bdb6` pubblicato su dev; migrazione 18 applicata al cloud autorizzato, **18/18**. Controlli remoti **34/35**, anomalia ACL sulla nuova vista ancora aperta. Rilascio sospeso; nessuna correzione cloud applicata. [Report aggiornato](DEPLOY_MIGRATION_18.md). Le indicazioni sotto di mancato push/deploy descrivono la fase storica di sviluppo locale.

Data: 22 ottobre 2026. Branch: `dev`. Base di lavoro: `d7cfc05`, successiva al deploy backend di 17 migrazioni. Tutte le verifiche applicative descritte sotto usano **account e nominativi fittizi su Supabase locale**. Nessun database cloud, account reale o branch `main` è stato modificato durante questa fase.

## Risultato

Frontend React/TypeScript strict integrato con Supabase Auth e RLS, installabile come PWA. Interfaccia italiana, menu desktop/mobile, tema chiaro/scuro, filtri per workspace, anno, scuola, classe e materia, ricerca studenti e feedback dei salvataggi.

Il frontend è collaudato localmente; **il rilascio operativo cloud richiede prima l'autorizzazione della migrazione 18**. Le 17 migrazioni già pubblicate restano inalterate. Fino all'aggiornamento autorizzato del backend, l'applicazione mostra un avviso e disabilita le modifiche didattiche sul progetto a 17 migrazioni. Non è stato effettuato alcun push, merge su `main` o deploy Pages in questa fase.

## Funzionalità implementate

| Area | Risultato e verifiche |
|---|---|
| Autenticazione | Login email/password, sessione persistente, rotte protette, recupero e cambio password, profilo, logout e scadenza offline. Login/logout verificati con due account locali; errori login e richiesta recupero senza email verificati con RTL. Nessuna registrazione pubblica. |
| Workspace e ruoli | Selezione personale automatica, cambio workspace e query separate per account/workspace, controlli UI Owner/Admin/Teacher/Viewer, RLS sempre applicata dal database. Isolamento dei due utenti verificato in browser; policy dei ruoli verificate nei test DB. |
| Dashboard | Lezioni odierne, prossime prove, consegne, ultime osservazioni, conteggi e media canonica quando il contesto è selezionato; stato iniziale senza dati. |
| Backoffice | Editor con validazione e CRUD delle otto anagrafiche scolastiche e dei cataloghi didattici; archiviazione e conservazione dei riferimenti storici. Ciclo UI creazione/modifica/archiviazione/ripristino studente verificato. |
| Import | CSV/XLSX, mappatura colonne, codici UUID opzionali, anteprima e duplicati server, decisione per ogni riga, applicazione atomica e successiva anteprima iscrizioni. CSV/XLSX con righe valide e duplicate verificati in browser. |
| Registro | Lezioni, attività, argomenti, studenti e creazione di osservazioni dalla lezione. Editor generici dei collegamenti disponibili nell'organizzazione. |
| Osservazioni | Descrittive e valutative, tipi configurabili, note/partecipazione/difficoltà/punti di forza, collegamenti ad argomenti/competenze/errori, pulsanti personali e voto separato con conferma. Osservazione rapida e offline verificate. |
| Compiti | Consegne, argomenti, esercizi, esiti individuali, pulsanti rapidi e contatori sui singoli esercizi, riepilogo massivo per classe, passaggio al prossimo studente, errori, autonomia/comprensione/suggerimenti e giustificazione strutturata con migrazione 18. Controllo completo e percentuale derivata verificati. |
| Verifiche/orali | Modalità rapida, analitica e rubriche con pesi/livelli/snapshot; quesiti e sottoquesiti, argomenti/competenze, errori/commenti, sequenza studenti, stato e punti, bozza calcolata dal server e conferma del voto canonico. Tutte e tre le correzioni e proposte attese verificate in browser. |
| Schede/statistiche | Anagrafica/iscrizioni, lezioni/attività, compiti, osservazioni, prove, voti e motivazioni, medie annuali e RPC per periodo, andamento/distribuzione, errori e competenze. Medie esclusivamente canoniche. Navigazione e dati del registro verificati; non ogni combinazione di filtro è coperta da E2E. |
| Export | CSV, XLSX e PDF di elenchi, osservazioni, voti, riepiloghi e scheda; neutralizzazione formule. File reali verificati in browser, struttura CSV/XLSX/PDF controllata; PDF fittizio renderizzato e ispezionato visivamente. |
| Offline | Consenso per dispositivo, Dexie cifrato AES-GCM, TTL, separazione account/workspace, coda/versioni/UUID, sincronizzazione automatica, retry, confronto dei conflitti e scelta esplicita. Test unitari, browser e service worker di produzione superati. |
| PWA | Manifest, icone, static cache, aggiornamento controllato, offline hard reload. Verificata con Chromium desktop; configurazione iOS predisposta. |
| AI | Interfaccia esplicitamente non disponibile, adapter disabilitato e stub Edge Function esistente. Nessun provider, risposta simulata o invio di dati studenti. |
| CI/deploy | Workflow test frontend/DB e PWA locale; workflow Pages limitato a `main` e gate di attivazione esplicito. Nessun comando di migrazione cloud nei workflow frontend. |

Gli editor generici condividono metadata e validazione; non è stato eseguito un test browser distinto per ogni tabella del catalogo. Le verifiche DB coprono vincoli compositi, RLS, immutabilità, audit, snapshot, import, idempotenza e concorrenza.

## Collaudo eseguito

| Controllo | Esito |
|---|---|
| TypeScript strict | Superato |
| Vitest / React Testing Library | **21 test superati**, 4 file |
| Playwright Chromium | **10 scenari superati**: navigazione/isolation/mobile, osservazione rapida, compiti e voto rapido, export 3 formati, offline/logout, signup negato, CRUD studenti, import CSV/XLSX, analitica/orale, conflitto e scelta remota |
| PWA build di produzione | Superato: manifest, service worker attivo, ricaricamento offline, coda, resync, Cache API priva di risposte Auth/REST |
| PostgreSQL locale | **17.11**, `server_version_num=170011` |
| Migrazioni da zero | **18**, su **due ricostruzioni locali** con seed fittizio |
| pgTAP | **81 per ciclo**, cioè 69 backend + 12 estensioni frontend; entrambi i cicli superati |
| SQL integrazione | **69 per ciclo**, entrambi superati |
| Concorrenza | **Due prove superate**, una per ciclo; revisione successiva non sovrascritta |
| Supabase DB lint | Pulito su entrambi i cicli, schemi `public,private` |
| Produzione Vite/PWA | Build riuscita con generazione service worker e manifest |
| Audit npm | **0 vulnerabilità** dopo aggiornamento Vitest 4.1.12 e override compatibile uuid di ExcelJS |

Gli errori iniziali hanno portato a correzioni effettive: prebundling delle librerie export per evitare reload del server di sviluppo al primo PDF, chiave AES iniziale con scritture concorrenti, accessibilità dei selettori, menu desktop non scorrevole su schermi bassi, ritorno del risultato server dopo flush, attesa del salvataggio della correzione prima della proposta e conflitti PostgREST. È stato corretto anche un problema di fixture E2E: le prove inserite direttamente dopo il caricamento del browser richiedono una ricarica prima della verifica. I risultati sopra si riferiscono ai passaggi riusciti dopo le correzioni.

Evidenze riproducibili: `npm test`, `npm run test:e2e`, `npm run test:pwa`, `npm run build`, `npm run test:supabase:local`. Log, screenshot, download, tracce e credenziali fittizie restano in cartelle ignorate da Git.

## Migrazione 18 e anomalia risolta

File: `supabase/migrations/20261022000200_frontend_workflows.sql`.

- `homework_checks.excused/excuse_reason` e vincolo del motivo obbligatorio.
- `assessments.evaluation_rule_id`, FK composta, indice e collegamento di accesso.
- `v_homework_completion`, security invoker e nessun accesso anonimo.
- `frontend_sync_mutation` e `frontend_apply_import`, security invoker, grant solo autenticati, mapping del conflitto a `PT409`.

Il test ha riprodotto un problema di piattaforma documentato: PostgREST 14 ritenta indefinitamente RPC che sollevano `40001`. Gli adapter mantengono intatte RPC e migrazioni originali e traducono l'errore in HTTP 409 prima che raggiunga PostgREST. Il client preserva la coda, mostra il confronto e richiede una decisione. [Nota ufficiale Supabase](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).

Modifica Auth **solo locale**: signup globale disabilitato e provider email abilitato. Il test di signup verifica il rifiuto. Non è stato eseguito `config push`.

## Limiti e attività successive al consenso

- Applicare la migrazione 18 al solo progetto cloud autorizzato dopo revisione, verifica ref e dry-run. Al momento le nuove funzionalità non sono distribuite nel cloud.
- Non sono state usate le password dei due account reali: login effettivo, SMTP/redirect di recupero e cambio password vanno collaudati dall'utente dopo configurazione del rilascio. Il flusso email completo di recupero non è stato verificato end-to-end.
- Installazione e aggiornamento su Android/iPhone/Safari reali non verificati; Chromium non sostituisce il collaudo dei dispositivi.
- GitHub Actions è configurato ma non eseguito su GitHub, perché il lavoro non è stato pubblicato. Quota/condizioni Pages e idoneità per autenticazione e dati scolastici richiedono revisione prima dell'attivazione; vedere il documento deploy.
- Cache cifrata con chiave nello stesso browser: non protegge da un browser sbloccato o da XSS. Usare solo dispositivi personali protetti; TTL e logout non eliminano export già scaricati.
- Non è stato eseguito un benchmark di carico su grandi workspace; il collaudo usa dataset fittizi piccoli. ExcelJS mantiene un chunk dinamico di circa 929 kB, segnalato come warning non bloccante; le statistiche sono caricate separatamente. PDF con font standard: italiano verificato, alfabeti non latini/emoji richiedono font incorporati dedicati.
- Il modulo condiviso dei dettagli didattici concentra tre flussi; le componenti di riepilogo, voto e storico sono separate, ma ulteriore suddivisione può agevolare l'estensione futura. Nessuna funzionalità AI generativa è attivata.

## File e continuazione

Nuovi moduli in `src/` (componenti/pagine/domain/hooks/services/state/offline/types), `public/` (icone), `index.html`, configurazioni Vite/TS/Vitest/Playwright, fixture e smoke test PWA in `scripts/`, test browser in `tests/frontend/`, migrazione/test SQL incrementali e workflow `frontend.yml`/`pages.yml`. Aggiornati package/lockfile, ignore, configurazione locale Supabase, runner DB e README.

[Architettura e avvio](FRONTEND.md) · [Istruzioni di rilascio](DEPLOY_FRONTEND.md). Il commit finale resta locale su `dev`; l'hash è riportato nella consegna e consultabile con `git log -1 --oneline`. Nessun frontend o database cloud è pubblicato da questa fase.
