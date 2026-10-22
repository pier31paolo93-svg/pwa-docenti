# Primo rilascio Pages — pronto per il merge autorizzato

Il gate repository **PAGES_DEPLOY_ENABLED=true** è stato abilitato su richiesta dell'utente. La modifica della variabile non avvia workflow: non è stato eseguito alcun dispatch, merge o deploy. Il merge della PR #1 su main avvierà automaticamente il workflow Pages, che pubblicherà soltanto dopo il successo di entrambe le validazioni frontend/PWA e database locale.

## Vincoli verificati

- Pages: Source GitHub Actions (`build_type=workflow`), HTTPS attivo.
- Environment: `github-pages`, unica regola di deployment branch `main`, nessun tag. I job Pages richiedono anche `github.ref == 'refs/heads/main'` e gate true, compreso l'avvio manuale.
- Variabili di build repository: soltanto `VITE_SUPABASE_URL=https://mwabfmooefmkszlrymyx.supabase.co` e `VITE_SUPABASE_PUBLISHABLE_KEY` con chiave pubblica. Verificata uguaglianza tra chiave della build locale di produzione e variabile GitHub; nessuna variabile environment che le sovrascriva.
- La build rifiuta progetto errato, chiavi secret, placeholder e variabili Vite aggiuntive. Nessuna password, token o chiave amministrativa viene inserita nel frontend, nel commit o nella descrizione della PR.
- Vite, manifest id/start_url/scope e fallback del service worker: `/pwa-docenti/`. HashRouter preserva la compatibilità Pages senza rewrite server. Aggiornamento PWA su richiesta e cache API Auth/REST esclusa.
- Nessun comando di deploy Supabase nel workflow Pages o nei workflow richiamati. Migrazioni/seed/reset dei test riguardano soltanto i container temporanei locali dei runner. Database cloud, account e workspace restano invariati.

## Collaudo e attivazione

Comandi di verifica: `npm test`, `node scripts/test-release-config.mjs`, `npm run test:e2e`, `npm run test:pwa`, `npm run build`, `node scripts/verify-pages-build.mjs`. E2E/PWA utilizzano solo Supabase Docker e account/dati fittizi; la build finale utilizza la configurazione pubblica di produzione. I log sono ignorati da Git. Esiti del nuovo commit e link alle esecuzioni GitHub sono riportati nella PR #1.

Ripetizione locale completata: **21/21 unitari, 5/5 controlli configurazione, 10/10 scenari browser**, collaudo PWA offline/sincronizzazione/aggiornamento e build TypeScript/Vite/artefatto Pages superati. Resta il warning non bloccante del chunk dinamico ExcelJS oltre 900 kB. Nessuna credenziale privilegiata rilevata nell'artefatto.

Il deploy resta in attesa dell'autorizzazione al merge. Dopo il merge autorizzato: controllare i job di validazione, build e deploy nell'environment github-pages; quindi verificare `https://pier31paolo93-svg.github.io/pwa-docenti/`, login/logout/workspace, salvataggi fittizi autorizzati, isolamento e installazione/aggiornamento sui dispositivi reali. Non sono stati usati gli account reali per testare scritture cloud in questa preparazione. Site URL e redirect Auth sono stati configurati dall'utente e non modificati qui.

Per sospendere il rilascio **prima di nuovi avvii**, riportare PAGES_DEPLOY_ENABLED a false. Questo non annulla un job già avviato e non ritira un sito pubblicato; controllare separatamente le esecuzioni attive. Main non è stato modificato durante la preparazione.

Il [report iniziale](RELEASE_READINESS.md) resta storico: le indicazioni di gate false e Pages non ancora configurato descrivono il primo preflight. Lo stato attuale è quello di questo documento e della PR aggiornata. Le limitazioni di collaudo e la valutazione dell'hosting già documentate restano applicabili.
