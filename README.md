# PWA Docenti — backend, fase 1
Backend SQL per Supabase; nessun frontend implementato.

**Stato:** implementazione locale. Il deploy cloud richiede ancora la verifica dello stack Supabase Docker e l'autorizzazione esplicita. Nessuna migrazione remota eseguita.

## Contenuto
- 44 tabelle pubbliche con RLS, 2 tabelle tecniche private, 10 viste security_invoker.
- 16 migrazioni SQL ordinate per dipendenza.
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
Per verificare la ripetibilità, ripetere reset locale, test e lint.
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

Non usare reset remoto, --include-seed o chiavi privilegiate nel client. Il deploy e il push GitHub non sono automatizzati da questo progetto.
