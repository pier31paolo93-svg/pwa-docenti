# Frontend PWA — Quaderno Docenti

## Avvio

Node 22.12+ e npm. `npm ci`, copiare `.env.example` in `.env.local` e configurare l'URL del progetto e la sola chiave `sb_publishable_…`. `npm run dev`; aprire `/pwa-docenti/`. `.env.local`, `.env.test.local`, build e dati di collaudo sono ignorati da Git. Non inserire password degli account o chiavi privilegiate nel frontend.

La configurazione locale corrente punta al progetto autorizzato `mwabfmooefmkszlrymyx`; nessun account reale è stato usato per i test. Accedere con le credenziali già assegnate. Non esistono registrazione pubblica, unione dei workspace o creazione di account dal frontend.

## Architettura

- `src/types/database.ts`: tipi generati dallo schema Supabase locale PG17.
- `src/services`: client Auth/PostgREST, RPC, esportazioni, adapter AI disabilitato.
- `src/state`: sessione, selezione workspace, TanStack Query, filtri persistenti.
- `src/domain`: catalogo delle entità, relazioni composite, validazione Zod e filtri.
- `src/components`: modali, form RHF, conferma voti, correzioni, riepiloghi ed export.
- `src/pages`: login, dashboard, backoffice, osservazioni, registro, compiti, verifiche, schede, statistiche, import, impostazioni e coda.
- `src/offline`: cache cifrata Dexie, coda persistente, UUID operazione, conflitti e retry.
- `tests/frontend`: Playwright con due utenti fittizi locali; `src/**/*.test.*`: Vitest/RTL.

La lettura usa esclusivamente il client autenticato e le policy RLS; tutte le modifiche didattiche passano da `frontend_sync_mutation`, adapter della RPC `sync_mutation`, con versione attesa e UUID idempotente. Profili e RPC import usano le API specifiche dello schema. Le tabelle vengono paginate per UUID; le viste aggregate per dimensioni ordinate. Il frontend non contiene service role o credenziali di amministrazione.

I cataloghi di valutazione vanno configurati da Owner/Admin in Organizzazione. Il frontend non installa automaticamente dati iniziali nel workspace reale. Scuola → anno → classe → materia → associazione classe/materia → assegnazione docente → studenti/iscrizioni costituiscono il contesto dei flussi didattici. I riferimenti storici immutabili non sono riassegnabili dall'editor. L'archiviazione di un genitore con dati collegati è bloccata nei casi gestiti per conservare lo storico.

## Valutazione

`grade_entries` rimane l'unico registro canonico. Un'osservazione descrittiva non crea voti. Ogni origine ha una sola voce: l'editor aggiorna quella esistente. Il pulsante per la bozza richiede rete e ottiene la proposta dal database; la conferma è una scelta esplicita del docente. Modificare un voto già confermato richiede motivazione. Pesi, categoria, esclusione e inclusione del comportamento sono espliciti.

Le medie provengono da `v_student_averages`, `v_class_dashboard`, `v_subject_dashboard` e `student_average`; nessuna media dei voti è calcolata nel browser. Conteggi e somme dei punteggi della correzione sono riepiloghi, non voti. Nella scheda, la media per periodo usa la RPC quando una materia è selezionata; la tabella annuale resta esplicitamente annuale. Conferma e snapshot sono validati dal backend, anche se il client viene alterato.

## Migrazione 18 separata

`20261022000200_frontend_workflows.sql` aggiunge giustificazione/motivo dei compiti, regola predefinita della verifica e vista protetta del completamento. Include gli adapter `frontend_sync_mutation` e `frontend_apply_import`, security invoker: intercettano `40001` e restituiscono `PT409` (HTTP 409). Il test ha riprodotto il problema dei retry infiniti di PostgREST 14, documentato da [Supabase](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).

La migrazione 18 è stata applicata sul solo cloud autorizzato pwa-docenti: **18/18**, prime 17 inalterate. Il rilascio operativo resta sospeso per privilegi ereditati eccessivi sulla nuova vista (34/35 controlli remoti superati). Correzione ACL proposta separatamente e non applicata: [report deploy 18](DEPLOY_MIGRATION_18.md). Non eseguire ulteriori modifiche cloud senza nuova autorizzazione.

## Offline e privacy

Disattivato per impostazione predefinita, attivabile nelle impostazioni con consenso per dispositivo personale. AES-GCM, IV casuali, chiave non esportabile per account in IndexedDB, autenticazione del nome del record e dell'account; cache separata per workspace. Cache dati/identità: TTL di otto ore. Sessioni scadute bloccano consultazione e sincronizzazione offline. La cifratura riduce esposizione accidentale dei file, ma la chiave risiede nello stesso browser: un dispositivo sbloccato o uno script compromesso possono leggere i dati. Non equivale a cifratura con passphrase o protezione da XSS.

Le modifiche pendenti sono cifrate senza scadenza per non perderle; vengono eliminate dopo conferma server, scelta esplicita di scarto o logout. La coda mostra campi locali/remoti e ferma gli aggiornamenti su conflitto `40001`/`PT409`; non applica una politica last-write-wins. Il retry crea una nuova operazione sulla revisione riletta solo dopo decisione dell'utente. Le operazioni sono serializzate anche tra schede dove Web Locks è disponibile; in browser più vecchi rimane la serializzazione nella singola scheda. Il database conserva l'ultima difesa tramite idempotenza e versioni.

Al logout vengono rimossi cache personale, chiave, preferenze personali e sessione locale; con modifiche pendenti viene chiesta conferma dello scarto. Le esportazioni sono file personali esterni alla cache: non possono essere revocate o eliminate dall'app dopo il download. Non usarle su dispositivi condivisi.

Il service worker memorizza soltanto risorse statiche: nessuna API Auth, REST o risposta con dati personali viene inserita nella Cache API. I dati autorizzati sono nella memoria di TanStack Query oppure nella cache cifrata solo se abilitata. Le esportazioni neutralizzano formule CSV/XLSX e non ampliano il perimetro RLS.

## Collaudo locale

Docker Desktop attivo; `npx --no-install supabase start` (output CLI contiene chiavi locali: non pubblicarlo). Porte API56321/DB56322/Studio56323. `auth.enable_signup=false` vieta signup; `auth.email.enable_signup=true` mantiene il provider email disponibile: la CLI interpreta il secondo parametro anche come abilitazione del provider. Verificato sullo stack locale; non trasferire la configurazione con `config push`. [Riferimento ufficiale al problema CLI](https://github.com/supabase/cli/issues/7055).

`npm test`; `npm run typecheck`; `npm run build`. Per E2E: `node scripts/frontend-fixtures.cjs`, `npx playwright install chromium`, `npm run test:e2e`. Lo script fixture rifiuta qualsiasi URL diverso dalla porta locale autorizzata e usa la chiave amministrativa soltanto nel processo Node locale. Nessuna password reale è richiesta. Tutti i nominativi di collaudo sono fittizi. `.env.test.local` è generato con la sola chiave pubblica locale; il server Playwright parte in modalità `test`.

I workflow CI eseguono build/test e Supabase Docker locale; non effettuano migrazioni remote. Gli esiti effettivi e le limitazioni sono nel report di fase 2.
