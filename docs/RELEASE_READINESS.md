# Preparazione rilascio Quaderno Docenti — 22 ottobre 2026

## Stato

Preparazione sul branch `dev`, che include `ae03059` e tutte le 19 migrazioni. Backend cloud invariato in questo intervento. Il repository `pier31paolo93-svg/pwa-docenti` è **pubblico**; Actions è abilitato. Nessun merge su main, pubblicazione Pages o dispatch di produzione. Il gate repository **PAGES_DEPLOY_ENABLED=false** è stato configurato e verificato.

Le seguenti variabili repository Actions sono configurate: `VITE_SUPABASE_URL=https://mwabfmooefmkszlrymyx.supabase.co` e `VITE_SUPABASE_PUBLISHABLE_KEY` con la chiave publishable effettiva, recuperata in sola lettura dal solo progetto autorizzato senza rivelare chiavi secret. Il precedente `.env.local` conteneva un placeholder, sostituito nel solo file ignorato da Git. Nessuna chiave amministrativa/token/password entra nelle variabili Vite o nell'artefatto di produzione. La chiave publishable è pubblica per definizione: i permessi restano affidati a JWT/RLS.

## Configurazione e collaudo locale

| Controllo | Esito |
|---|---|
| Presenza commit ae03059 su dev | Confermata, presente anche sul dev remoto prima del nuovo lavoro |
| Vitest/RTL | **21/21** |
| Configurazione produzione | **5/5**: variabili approvate accettate; progetto errato, secret, placeholder e variabile extra rifiutati |
| Playwright Chromium | **10/10**, account e dati interamente fittizi su Docker locale |
| Login/logout e workspace | Passati nei test locali, isolamento tra due account |
| Salvataggi Supabase | CRUD, osservazioni, compiti, valutazioni, import e conflitti passati sullo stack locale |
| Build produzione | TypeScript e Vite/PWA superati, URL/chiave pubblica del progetto corretto |
| Artefatto Pages | Base e asset, manifest, service worker e scansione pattern segreti superati |
| PWA produzione con backend locale | Installazione SW, reload offline, coda, resync, Cache API statica, avviso aggiornamento e attivazione preservando la rotta superati |

Vite usa `/pwa-docenti/`; React usa HashRouter, quindi `#/studenti` resta compatibile con refresh Pages senza rewrite server. Manifest id/start_url/scope sono `/pwa-docenti/`, display standalone e icone presenti. Il service worker ha aggiornamento su richiesta, pulizia cache obsolete e nessuna cache runtime delle API Auth/REST. Il test aggiornamento modifica temporaneamente il solo SW locale generato e lo ripristina a fine prova.

La build finale è stata rigenerata in modalità produzione dopo il test PWA locale. Il precache comprende 22 risorse per circa 2,9 MiB; rimane il warning non bloccante del chunk dinamico ExcelJS oltre 900 kB. In fase di preparazione è stato corretto un errore sintattico nel nuovo verificatore degli asset; la verifica finale è passata. Installazione/aggiornamento su Android e Safari iOS reali non ancora collaudati.

## Verifiche cloud esclusivamente in lettura

Con la sola chiave publishable: `/auth/v1/settings` risponde HTTP 200; signup disabilitato, provider email abilitato. SELECT anonimo su `v_homework_completion` respinto con HTTP 401. Nessun login dei due Owner, uso delle loro password, salvataggio cloud, creazione utenti o modifica Auth/schema/dati. Il collaudo precedente 19/19 e 35/35 rimane quello documentato nel report della migrazione 19; non è stato presentato come una nuova esecuzione di tutti i controlli in questa fase.

Il test locale autentica realmente due account fittizi e verifica richieste HTTP al Supabase Docker; non sostituisce la verifica dei login/salvataggi sul dominio pubblicato. Tale verifica non viene simulata usando gli account reali o scrivendo dati sul cloud, perché il cloud deve rimanere invariato.

## Workflow

- `frontend.yml`: su push dev/main e PR, e riutilizzabile da Pages; unit test, guard configurazione, build test, Supabase locale, fixture fittizie, E2E, PWA e verifica artefatto. Nessun segreto cloud; il build di CI usa modalità test e URL locale.
- `database.yml`: su dev/PR e riutilizzabile; migrazioni, pgTAP e lint su database Docker temporanei del runner. Gli eventuali reset/seed sono esplicitamente **locali al runner**, mai cloud. Output di avvio Supabase con chiavi locali rediretto in file temporaneo non pubblicato.
- `pages.yml`: esclusivamente main e gate true. Richiama entrambi i workflow di validazione e costruisce l'artefatto di produzione solo dopo il loro successo. Validazione Project URL/chiave e controllo aggiuntivo in Vite. Upload artefatto Pages, poi deploy tramite environment github-pages. Contenuti in sola lettura; permessi pages/id-token di scrittura limitati al job deploy.

L'aggiunta di `workflow_call` non apre il gate di produzione. Push dev/PR eseguono soltanto test. Nessun comando di deploy Supabase nei workflow frontend/Pages. Anche con main aggiornato, il gate false impedisce build/deploy Pages. La PR deve essere revisionata prima di qualsiasi autorizzazione al rilascio.

## GitHub Pages e passaggi manuali prima del futuro rilascio

La lettura autenticata delle API GitHub ha restituito 404 per Pages e per l'environment github-pages: **non risultano configurati** al momento del controllo. Non sono stati creati o abilitati, per evitare pubblicazioni prima dell'autorizzazione. Le variabili Actions necessarie sono già presenti; non devono contenere service_role, sb_secret, token o password.

1. Revisionare la PR dev → main e attendere i check GitHub verdi; non effettuare merge fino all'autorizzazione esplicita dell'utente. Il gate deve restare false durante questa preparazione.
2. Prima dell'attivazione autorizzata, Settings → Pages → Build and deployment → Source **GitHub Actions**. Il repository pubblico è compatibile anche con GitHub Free. Verificare HTTPS e l'URL previsto `https://pier31paolo93-svg.github.io/pwa-docenti/` dopo il primo deploy, non dichiarato già pubblicato.
3. Settings → Environments: configurare github-pages con ramo ammesso main e revisione obbligatoria del proprietario, se disponibile. Verificare assenza di variabili di environment che sovrascrivano la configurazione pubblica del progetto; il Vite guard blocca eventuali URL/chiavi non ammesse.
4. Sul pannello Supabase, verificare Site URL e allowlist redirect per l'URL esatto dell'app, compresa la barra finale `/pwa-docenti/`, e il flusso recupero password. Nessuna configurazione Auth è stata cambiata da questa preparazione. Eventuali modifiche richiedono l'autorizzazione dell'utente.
5. Dopo autorizzazione al merge **e** al deploy, impostare consapevolmente PAGES_DEPLOY_ENABLED=true e integrare la PR su main (oppure, se main fosse già integrato con gate chiuso, eseguire il workflow Pages da main dopo l'autorizzazione). Non avviare dispatch da dev.
6. Sul sito pubblicato, l'utente prova login/logout dei due Owner senza comunicare password, workspace distinti, recupero password, salvataggi fittizi autorizzati e reload, isolamento, installazione e aggiornamento sui dispositivi reali. Un test di scrittura cloud richiede autorizzazione distinta e dati inventati.

La compatibilità tecnica del repository non costituisce approvazione delle condizioni d'uso: GitHub segnala che Pages non dovrebbe essere usato per transazioni sensibili come l'invio di password. La PWA invia le credenziali direttamente a Supabase via HTTPS, ma questo non risolve automaticamente la valutazione di idoneità dell'hosting per un'app scolastica autenticata. Prima del rilascio va confermata la scelta dell'hosting e l'idoneità al trattamento previsto. [Condizioni e limiti ufficiali GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

## Evidenze

Comandi: `npm test`, `node scripts/test-release-config.mjs`, `npm run test:e2e`, `npm run test:pwa`, `npm run build`, `node scripts/verify-pages-build.mjs`. Fixture/browser usano solo endpoint locale 127.0.0.1:56321; log e file ambiente in cartelle ignorate. I risultati GitHub Actions devono essere letti separatamente dai test locali e sono riepilogati nella consegna della PR.
