# PWA Docenti — Quaderno Docenti

Frontend React/TypeScript PWA e backend Supabase PostgreSQL 17. Per avviare il frontend: `npm ci`, configurare `.env.local` seguendo `.env.example`, poi `npm run dev` e aprire `/pwa-docenti/`.

**Fase 2:** interfaccia e flussi integrati con RLS, collaudo su dati fittizi locali. Migrazione 18 applicata sul cloud autorizzato: **18/18**. Rilascio sospeso per anomalia ACL sulla nuova vista, controlli remoti **34/35**; correzione separata proposta e non applicata. [Deploy migrazione 18](docs/DEPLOY_MIGRATION_18.md), [architettura e utilizzo](docs/FRONTEND.md), [deploy frontend](docs/DEPLOY_FRONTEND.md), [report fase 2](docs/REPORT_FASE_2.md). Nessun merge su `main` o pubblicazione Pages.

**Storico backend:** primo deploy di 17 migrazioni completato il 22 ottobre 2026 sul solo pwa-docenti, Ref mwabfmooefmkszlrymyx, senza seed e con signup pubblico disabilitato. Il relativo report documenta i precedenti 35 controlli e confronto di 1.505 definizioni. Lo stato attuale dopo la migrazione 18 è riportato sopra; i due account Owner e i rispettivi workspace sono rimasti invariati.

## Contenuto
- 44 tabelle pubbliche con RLS, 2 tabelle tecniche private, 11 viste security_invoker.
- 18 migrazioni SQL applicate; proposta ACL successiva fuori dalla cartella delle migrazioni attive.
- Workspace personale automatico per ogni utente; Owner, Admin, Teacher, Viewer.
- Registro canonico dei voti, curve configurabili, audit e snapshot di correzione.
- RPC offline con idempotenza e controllo versione; import JSON con anteprima.
- Seed esclusivamente locale: 2 utenti/workspace, 2 scuole, 3 classi, 15 studenti inventati.
- AI bloccata e stub Edge Function senza provider.

## Avvio locale completo
Prerequisiti: Node.js supportato dalla CLI, npm, Docker Desktop con motore Linux.
```powershell
npm ci
npm run db:start
npm run db:reset:local
npm run db:test
npm run db:lint
```
Il config usa PostgreSQL 17, richiesto dalla CLI installata 2.121.0.
Su Windows, dopo l'avvio dello stack, `npm run test:supabase:local` esegue due ricostruzioni con pgTAP, SQL diretto, lint e concorrenza. Porte locali: API 56321, database 56322, Studio 56323; vedere il setup per il conflitto con le porte riservate da Windows e la raccolta log opzionale disabilitata.
Il seed non configura password o login utilizzabili: sono fixture SQL, non account di produzione.

## Verifica PostgreSQL nativa
```powershell
npm run test:native
```
Usa PostgreSQL 16 in C:\Program Files\PostgreSQL\16\bin, loopback 127.0.0.1:55439 e cluster .local-test/; crea due database puliti e arresta il server alla fine. Non accede al PostgreSQL di sistema o al cloud. Auth è simulata soltanto nel bootstrap di test. Dettagli e limiti in [TEST_REPORT](docs/TEST_REPORT.md).

## Documentazione
- [Architettura](docs/ARCHITETTURA_DATABASE.md)
- [Modello dati](docs/MODELLO_DATI.md)
- [Sicurezza RLS](docs/SICUREZZA_RLS.md)
- [Sincronizzazione offline](docs/OFFLINE_SYNC.md)
- [AI e privacy](docs/AI_PRIVACY.md)
- [Setup e deploy](docs/SETUP_SUPABASE.md)
- [Report verifiche](docs/TEST_REPORT.md)
- [Preflight deploy cloud](docs/PREDEPLOY_SUPABASE.md)
- [Risultato deploy cloud](docs/DEPLOY_SUPABASE.md)

Non usare reset remoto, --include-seed o chiavi privilegiate nel client. Il deploy e il push GitHub non sono automatizzati da questo progetto.
