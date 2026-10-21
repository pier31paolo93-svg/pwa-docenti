# PWA Docenti — backend, fase 1
Backend SQL per Supabase; nessun frontend implementato.

**Stato:** collaudo locale completato su Supabase Docker / PostgreSQL 17.11. Due ricostruzioni pulite, ciascuna con 69 test pgTAP, 69 controlli SQL, lint public/private senza warning e una prova di concorrenza. Pronto per preflight e deploy cloud controllato, previa autorizzazione esplicita. Nessuna migrazione remota eseguita.

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

Non usare reset remoto, --include-seed o chiavi privilegiate nel client. Il deploy e il push GitHub non sono automatizzati da questo progetto.
