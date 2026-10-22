# Report di collaudo — 21 ottobre 2026
Deploy remoto autorizzato completato il 22 ottobre: 17 migrazioni, 35 controlli non distruttivi superati e 1.505 definizioni coincidenti con il locale. Nessuna fixture o account remoto creati. Esito separato in [DEPLOY_SUPABASE.md](DEPLOY_SUPABASE.md).

Aggiornamento 22 ottobre: nel preflight è stata aggiunta una migrazione ACL, lasciando invariate le 16 qui collaudate. Il pacchetto di 17 migrazioni ha superato nuovamente due cicli di 69 pgTAP, 69 SQL, lint e concorrenza. Collegamento cloud e dry-run verificati senza applicazione remota: vedere [PREDEPLOY_SUPABASE.md](PREDEPLOY_SUPABASE.md). I risultati del 21 ottobre qui sotto restano come evidenza storica.

## Esito
**Collaudo locale Supabase PostgreSQL 17.11 completato positivamente.** Due ricostruzioni da zero delle 16 migrazioni e del seed, con identico risultato:

| Controllo | Ciclo 1 | Ciclo 2 |
|---|---|---|
| Versione PostgreSQL effettiva | 17.11 (170011) | 17.11 (170011) |
| Migrazioni applicate | 16/16 | 16/16 |
| pgTAP | 69/69 PASS | 69/69 PASS |
| Asserzioni SQL dirette | 69/69 PASS | 69/69 PASS |
| Lint public e private, fail-on warning | 0 problemi | 0 problemi |
| Due connessioni concorrenti | PASS | PASS |

Totale delle due ricostruzioni finali: **138 verifiche pgTAP, 138 verifiche SQL dirette e 2 prove di concorrenza reale**. pgTAP e SQL eseguono le stesse 69 verifiche applicative attraverso due modalità; non sono 138 casi funzionali distinti per ciclo.

Comando eseguito:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-supabase-local.ps1
```
Alias disponibile: `npm run test:supabase:local`.
Runner: scripts/test-supabase-local.ps1. Log completo locale escluso da Git: .local-test/supabase-test.log.
Evidenza sintetica priva di credenziali: TEST_RESULTS.txt.

## Ambiente reale
| Componente | Versione / configurazione |
|---|---|
| Docker Desktop | 4.96.1, contesto desktop-linux |
| Docker Engine | 29.9.2, WSL2 Linux |
| Supabase CLI | 2.121.0, dipendenza locale esatta |
| Immagine PostgreSQL | public.ecr.aws/supabase/postgres:17.11.0.004 |
| PostgreSQL nel container | 17.11, server_version_num=170011 |
| Node / npm | 25.7.0 / 11.10.1 |
| Container database | supabase_db_pwa-docenti-local |
| Porte locali | shadow 56320, API 56321, DB 56322, Studio 56323, SMTP 56324 |

Il secondo collaudo usa i ruoli e lo schema Auth reali dello stack Supabase. Non usa scripts/native-bootstrap.sql o il PostgreSQL 16 nativo. Le precedenti prove native su PostgreSQL 16.14 erano già passate e restano un percorso alternativo di verifica.

## Aree verificate dai 69 casi
- Workspace automatico per ogni utente e ruolo Owner, senza superamministratore globale.
- Seed fittizio: 2 workspace, 2 scuole, 3 classi, 15 studenti.
- Isolamento dei workspace in lettura e scrittura; FK composite anche in bypass RLS amministrativo.
- Ruoli: nessuna auto-promozione, autoassegnazione o sostituzione del proprietario; limiti Teacher, Viewer e Admin.
- Privati non leggibili da altri utenti, anche Admin; proprietà e visibilità protette.
- Anonimo senza accesso a tabelle, viste e RPC; RLS su tutte le tabelle pubbliche.
- Studenti di altra classe, quesiti di altra verifica e argomenti di altra materia respinti.
- Registro canonico, unicità dell'origine, media fixture 7.6, esclusione di descrittive/voti annullati o esclusi.
- Conversioni lineari/non lineari, arrotondamento, limiti dei punteggi e snapshot immutabili.
- Audit delle revisioni, motivazione del cambio voto e impossibilità di modificare l'audit dal client.
- Conteggi dei compiti derivati coerenti.
- Retry idempotenti, conflitti di versione, campi protetti/sconosciuti, tombstone e rivalutazione delle autorizzazioni.
- Revoca effettiva del workspace condiviso senza perdere il workspace personale.
- Anteprima import, duplicati e applicazione delle righe valide.
- Viste security_invoker e RPC medie senza accesso ai dati altrui.
- AI disabilitata e non attivabile con UPDATE.

Le prove negative verificano lo SQLSTATE esatto. Il corpo delle asserzioni viene rollbackato dopo l'esecuzione.

## Concorrenza effettiva
Per ogni ricostruzione il runner avvia due processi psql indipendenti dentro il container PostgreSQL 17. Il primo aggiorna una riga e mantiene aperta la transazione per tre secondi. Il secondo tenta di scrivere la stessa revisione mentre il primo detiene il lock.

Verificati: commit del primo processo, attesa e SQLSTATE 40001 del secondo, permanenza del valore del primo processo e versione 2. Nessuna sovrascrittura silenziosa. Due prove superate in totale, una per ricostruzione.

## Correzioni emerse dal collaudo reale
1. Windows riserva TCP 54229–54328. Sostituite le porte standard del solo ambiente locale con 56320–56324 e 56327.
2. Il lint di propose_grade rilevava una variabile i dichiarata e poi ridefinita implicitamente dal FOR: rimossa la dichiarazione duplicata.
3. Il lint di preview_import rilevava l'inizializzazione testuale dell'array seen: usato array[]::text[].
4. Aggiornato il config da inbucket deprecato a local_smtp.
5. Vector locale cercava il motore Docker su TCP 2375, non esposto. Disabilitata Analytics/Vector soltanto nel config locale, senza cambiare la sicurezza del motore Docker.
6. Aggiunto runner ripetibile PostgreSQL 17 e allineato il lint di package.json/CI a public,private con --fail-on warning.

Le due migrazioni corrette non erano mai state applicate al cloud. Rimangono 16 migrazioni; tutte sono state riapplicate da zero dopo le correzioni.

## Limiti residui
Nessun errore o warning di schema residuo rilevato dal lint; tutti i controlli previsti passano.

La raccolta centralizzata dei log locali è disabilitata; i servizi applicativi principali rimangono attivi. Non è un impedimento al deploy del database, ma i log di sviluppo centralizzati non sono disponibili in questa configurazione Windows.

Questi controlli non costituiscono un audit esterno o un test di carico. Non includono frontend/IndexedDB, browser, autenticazione end-to-end via HTTP, parser binario CSV/XLSX, provider AI o runtime delle future Edge Function. Le policy SQL sono state esercitate con ruoli Supabase reali. Restano le considerazioni operative su retention audit/idempotenza e protezione della cache offline.

## Prontezza al deploy
**Il database è pronto per il preflight e il deploy cloud controllato sulla base del collaudo locale superato.** Prima dell'applicazione remota occorrono comunque identificazione del progetto pwa-docenti, controllo dello schema esistente e della cronologia, verifica della configurazione Auth per inviti, dry-run e autorizzazione esplicita dell'utente.

Nessuna autenticazione/link cloud, migrazione/seed remoto o reset remoto eseguiti. Nessun frontend e nessun push/merge GitHub eseguiti in questo collaudo. Modifiche conservate nel branch locale dev.
