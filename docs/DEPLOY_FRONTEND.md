# Deploy frontend

> Stato attuale: migrazione 19 completata, anomalia ACL risolta. Preparazione PR/Pages e configurazione Actions aggiornate nel [report di rilascio](RELEASE_READINESS.md); gate di produzione false. Le indicazioni di blocco ACL sotto descrivono lo stato storico dopo la migrazione 18.

> Aggiornamento dopo la correzione autorizzata: **19/19 migrazioni, 35/35 controlli remoti, 89/89 pgTAP locali**. Anomalia ACL della vista risolta; account/workspace invariati. [Report migrazione 19](DEPLOY_MIGRATION_19.md). Le precedenti indicazioni di blocco ACL descrivono lo stato storico dopo la 18.


## Stato e autorizzazioni

Il lavoro resta su `dev`. Nessun merge su `main` o pubblicazione Pages. La migrazione **18** è stata autorizzata e applicata separatamente al solo progetto `pwa-docenti`, Ref `mwabfmooefmkszlrymyx`: **18/18**. Comprende gli adapter HTTP PT409 e i campi didattici aggiuntivi; le 17 migrazioni esistenti non sono state riscritte. Il rilascio resta sospeso per una discrepanza ACL sulla nuova vista: [esito, controlli e proposta di correzione](DEPLOY_MIGRATION_18.md).

Il workflow `frontend.yml` si esegue su `dev`, `main` e PR: test, build e test browser con Supabase locale, senza credenziali cloud. Il workflow `pages.yml` pubblica esclusivamente `main` e solo con la variabile `PAGES_DEPLOY_ENABLED=true`; il gate resta chiuso per impostazione predefinita. La compilazione non contiene comandi Supabase di deploy.

## Prima dell'attivazione

1. Risolvere con autorizzazione separata la discrepanza ACL della vista e ripetere i controlli remoti. La 18 è già applicata: non riscriverla o riapplicarla. Nessun seed/reset sul cloud.
2. Valutare l'idoneità dell'hosting pubblico per il trattamento dei dati scolastici e le condizioni d'uso. La pagina serve solo asset statici; login e API passano via HTTPS direttamente a Supabase. La documentazione GitHub segnala che Pages non va usato per transazioni sensibili come l'invio di password: non presumere che questa architettura sia automaticamente approvata. [Limiti e condizioni ufficiali](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
3. Configurare manualmente le URL Auth di Supabase: Site URL dell'app autorizzata e redirect di recupero password esatto, inclusi `/pwa-docenti/` e l'eventuale dominio personalizzato. Mantenere signup disabilitato e provider email abilitato. Non usare `supabase config push`: la configurazione nel repository riguarda il locale.
4. Impostare le variabili Actions **pubbliche** `VITE_SUPABASE_URL=https://mwabfmooefmkszlrymyx.supabase.co` e `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…`. Questa chiave è pubblica per progetto: la sicurezza risiede in Auth/RLS. Mai `service_role`, `sb_secret_…`, token CLI o password nelle variabili Vite.
5. Abilitare GitHub Pages con sorgente GitHub Actions, configurare l'ambiente `github-pages` e le revisioni richieste. Solo dopo approvazione del rilascio, impostare `PAGES_DEPLOY_ENABLED=true` e integrare la PR autorizzata su `main`.

URL previsto dopo pubblicazione: `https://pier31paolo93-svg.github.io/pwa-docenti/`. Non è un URL dichiarato attualmente pubblicato dal presente lavoro. `HashRouter` mantiene refresh e deep link compatibili con Pages, per esempio `/pwa-docenti/#/studenti`.

## Build e controllo

`npm ci`, `npm test`, `npm run build`; l'output è `dist/`. La build include manifest, icone e service worker con soli asset statici. Recharts è caricato separatamente; ExcelJS e librerie PDF sono dinamici. ExcelJS mantiene un chunk ampio: la prima esportazione richiede quel download. Il precache è circa 3 MB; verificare la rete effettiva e l'installazione sui dispositivi prima del rilascio.

Su GitHub Free, Pages per repository pubblici è supportato. La documentazione consultata indica sito massimo 1 GB, limite morbido di banda 100 GB/mese e timeout di deploy 10 minuti; le pipeline Actions hanno anche le proprie quote. Questi limiti e le condizioni vanno ricontrollati prima dell'attivazione. Nessuna configurazione dell'account GitHub è stata cambiata dal frontend.

## Verifica dopo il rilascio autorizzato

Provare login con entrambi gli account esistenti, senza condividere password in chat; verificare workspace distinti, recupero password, dati reali autorizzati, RLS e cancellazione della cache al logout. Provare installazione Android e Safari iOS, aggiornamento service worker, offline, conflitti, export e notifiche di sincronizzazione. Il collaudo locale Chromium non sostituisce il collaudo sui dispositivi reali o l'approvazione del trattamento dei dati.

## Ripristino

Per il frontend, ripubblicare un precedente artefatto o revert approvato su `main`. La migrazione 18 è incrementale: un rollback dell'interfaccia non richiede DROP di colonne, cancellazioni di dati o reset del database. Eventuali interventi cloud richiedono piano e autorizzazione separati.
