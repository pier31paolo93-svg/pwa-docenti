# Report test — 21 ottobre 2026
## Esito finale reale
**69 asserzioni SQL superate per ciascuno di due database nuovi: 138 asserzioni eseguite.** Anche la prova con due processi PostgreSQL concorrenti è superata in ciascun database: 2 scenari concorrenti reali. Nessun test Docker/pgTAP o lint viene dichiarato superato.

Comando: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-native.ps1. Exit code finale: 0.
Log completo locale, ignorato da Git: .local-test/native-results.log.
```text
PASS concurrency: writer A committed, writer B rejected with 40001, winner preserved
PASS 1 : clean migration, seed, integration and concurrent writers
PASS concurrency: writer A committed, writer B rejected with 40001, winner preserved
PASS 2 : clean migration, seed, integration and concurrent writers
```

## Ambiente
| Strumento | Stato |
|---|---|
| Node.js / npm | 25.7.0 / 11.10.1 |
| Supabase CLI | 2.121.0, devDependency esatta e lockfile |
| PostgreSQL nativo | 16.14, cluster dedicato su 127.0.0.1:55439 |
| Config stack Supabase | PostgreSQL 17, richiesto dalla CLI |
| PostgreSQL 18 | Presente fuori PATH, non usato |
| Docker Desktop/motore | Non disponibile |
| pgTAP / plpgsql_check nativi | Non installati |
| Auth nel test nativo | Shim auth.users/auth.uid(), ruoli SQL reali |
| Supabase cloud | Non autenticato, non collegato, non modificato |
| GitHub | origin collegato al repository indicato, main ed22cc3, branch dev locale |

Il runner applica tutte le 16 migrazioni e il seed a due database creati da zero. Le asserzioni vengono rollbackate. Il cluster è arrestato al termine. Non usa il PostgreSQL di sistema o credenziali cloud.

## Aree verificate
| Area | Risultato |
|---|---|
| Provisioning | Due utenti, due workspace separati, ciascuno Owner |
| Seed | 15 studenti fittizi e 3 classi; lezioni, compiti e verifiche coerenti |
| Tenant | Accessi cross-workspace negati; FK composita verificata anche come amministratore SQL |
| Ruoli | No autoassegnazioni o auto-promozioni; Viewer non scrive; Teacher non scrive assegnazioni altrui; Admin non cambia ruoli |
| Privacy | Privati non leggibili da altri, anche Admin; visibilità immutabile |
| Proprietà | Autore e workspace non riscrivibili; spoofing negato |
| Privilegi | Anonimo senza accesso a tabelle, viste o RPC; audit non modificabile |
| Integrità | Studente di altra classe, quesito di altra prova, argomento di materia diversa respinti |
| Registro voti | Origini uniche; media fixture 7.6; descrittive non valutabili; esclusi/annullati fuori media |
| Regole | Conversione lineare/non lineare, arrotondamento, curva non valida respinta |
| Risultati | Punteggi oltre massimo negati; snapshot massimo immutabile |
| Audit | Revisioni registrate; motivazione obbligatoria per cambio valore |
| Compiti | Conteggi derivati coerenti |
| Offline | Idempotenza, conflitti versione, campi protetti/sconosciuti, tombstone, autorizzazione rivalutata al retry |
| Revoche | Perdita effettiva dell'accesso al workspace condiviso; workspace personale conservato |
| Import | Anteprima duplicati e applicazione righe valide senza duplicazioni |
| Viste | Tutte security_invoker; RPC medie non espone dati altrui |
| AI | Disabilitata e non attivabile con UPDATE |
| Ripetibilità | Due applicazioni complete su database nuovi |
| Concorrenza | A acquisisce lock e conferma; B attende e riceve 40001; valore/versione di A conservati |

Le prove negative verificano lo SQLSTATE esatto; un UPDATE/INSERT che non modifica righe non vale come prova di errore.

## Controlli bloccati
Tentati con CLI installata:
- supabase db lint --local --level warning
- supabase test db

Entrambi fermati con DbConnectError, ECONNREFUSED 127.0.0.1:54322, perché manca lo stack Supabase Docker. Nessuna esecuzione pgTAP/lint completata.

Suite pgTAP preparata in supabase/tests/001_backend.test.sql, generata dalla stessa suite nativa tramite scripts/generate-pgtap.mjs. Verificata la corrispondenza con node scripts/generate-pgtap.mjs --check. Workflow GitHub predisposto per due cicli reset locale/test/lint, non eseguito su GitHub.

Prima del cloud sono obbligatori stack Docker, pgTAP, lint --fail-on warning e ripetibilità su PostgreSQL Supabase 17; poi verifica Auth/PostgREST, identità remota, dry-run e autorizzazione esplicita.

## Correzioni durante la verifica
Corrette collisioni dei nomi degli indici e rilevamento degli indici FK esistenti. Reso ripetibile il bootstrap dei ruoli nel cluster. Corrette fixture affinché i tentativi proibiti non fossero INSERT SELECT vuoti e avessero autore nel test FK amministrativo. Rafforzato controllo ricorsivo delle assegnazioni e introdotta revoca logica dei membri. Corretto il recupero dell'exit code dei processi concorrenti PowerShell.

## Limiti residui
Le prove SQL non costituiscono audit indipendente. Restano da verificare PostgreSQL 17, Auth reale/JWT, PostgREST, Edge runtime e carico realistico. Nessun frontend, IndexedDB o parser binario CSV/XLSX realizzato in questa fase: import backend tramite JSON normalizzato.

La progressione numerica per competenza copre le correzioni analitiche; evidenze qualitative restano consultabili separatamente. La sincronizzazione richiede scansioni complete periodiche: updated_at non è un cursore commit. Occorrono politiche operative di retention di audit/idempotenza e protezione del dispositivo.

La registrazione pubblica cloud non è stata modificata: enable_signup=false locale non dimostra la configurazione cloud.

## Rilascio
44 tabelle pubbliche e 2 private, 16 migrazioni, 10 viste. Seed solo locale. Nessun progetto creato/eliminato, nessuna migrazione/seed remoto, nessun reset cloud, nessun provider AI attivato, nessun frontend.
