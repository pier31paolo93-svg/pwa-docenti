# Richieste V1.1 sulla versione V1.2–V1.4

## Ambito e modifiche

Il documento V1.1 è stato confrontato con l'ultimo main (`3f07c20`); dev è stato allineato con fast-forward. Non è stata ripristinata una versione precedente dell'applicazione.

Le funzionalità principali sono già implementate: responsive mobile/tablet, numero di registro nelle iscrizioni, editor precompilati con protezione dei riferimenti storici, filtro candidati per classe, messaggi per duplicati, passaggio anno transazionale e idempotente Owner/Admin con anteprima server e obbligo di connessione.

Il wizard Passaggio anno è stato separato nei cinque passaggi richiesti: annualità/classi origine, esiti, nuove classi, destinazioni/numeri/materie, anteprima/conferma. Si conservano stato, RPC, logica di proposta, storico e conferma esplicita esistenti. Le classi terminali non generano una sesta classe; sono disponibili diplomato, trasferito, ritirato e da definire. Nessuna operazione viene accodata offline.

Aggiornati il test E2E del wizard e l'audit responsive per includere il nuovo passaggio. Il server Vite dei test Playwright usa l'API ufficiale senza watcher/HMR, con porta fissa: evita blocchi di avvio nella cartella OneDrive senza cambiare il server di sviluppo o il prodotto.

## Database e compatibilità

Non sono necessarie nuove migrazioni. Le basi richieste sono già nelle migrazioni 21 (numerazione) e 22 (passaggio anno), presenti nella sequenza 1–26. Non sono stati modificati file di migrazione già applicati.

Dry-run sul solo progetto `pwa-docenti`, Ref `mwabfmooefmkszlrymyx`: database aggiornato; `migrations=[]`, `seeds=[]`, `roles=[]`. Nessuna migrazione, reset, seed o modifica dei dati è stata eseguita sul cloud in questa attività.

Il precedente collaudo remoto delle 26 migrazioni rimane sospeso sulle anomalie documentate in `DEPLOY_V1_2_V1_4_2026_10_24.md`. Queste modifiche frontend non risolvono né certificano le differenze delle impronte Auth/assessments.

## Verifiche completate

- 76 test unitari superati.
- 192 test pgTAP superati su PostgreSQL locale con 26 migrazioni.
- 69 controlli SQL locali superati; transazione conclusa con rollback.
- Lint PostgreSQL public/private: nessun errore.
- Typecheck e build produzione superati.
- Avviso build non bloccante: alcuni chunk superano 900 kB minificati; nessun errore di compilazione.
- Test PWA produzione superato: manifest, service worker, reload offline, accodamento/sincronizzazione e aggiornamento preservando la rotta.
- 8 E2E mirati superati: Organizzazione su desktop/tablet/telefono, directory docenti e isolamento, wizard a cinque passaggi/blocco offline, griglie, selezione iscritti.
- Suite E2E completa successiva: **33/33 superati**, inclusi editor CRUD, calendario nelle due orientazioni iPad, import idempotente, recupero, isolamento export e conflitti offline.
- Audit Chromium: 832 schermate a 320, 375, 390, 768, 820, 834, 1024 e 1180 px; zero overflow, campi stretti, target piccoli o dialoghi tagliati. Screenshot conservati nell'area locale ignorata da Git.
- Audit WebKit: ulteriori 832 schermate alle stesse otto larghezze, tutte senza le violazioni geometriche controllate. Totale: 1.664 schermate sui due motori.
- Cinque controlli di configurazione produzione superati, inclusi rifiuto di progetto errato, chiave secret e variabili frontend aggiuntive. Nessuna credenziale privilegiata trovata nei file modificati e nei report preparati per il commit.

La verifica automatizzata delle geometrie e WebKit non sostituisce un test su iPad fisico: selettore data nativo e tastiera virtuale reale devono essere confermati su iPadOS. Nessuna password o dato reale della docente viene usato nei test locali.

## Rilascio

Solo commit/push su dev e PR verso main; nessun merge o pubblicazione automatica richiesta. La PR deve restare in attesa di revisione. Prima del rilascio completare anche il collaudo remoto sospeso e la verifica su dispositivi reali.
