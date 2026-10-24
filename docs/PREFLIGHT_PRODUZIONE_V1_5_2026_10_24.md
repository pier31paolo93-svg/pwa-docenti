# V1.5 — preflight produzione del 24 ottobre 2026

## Esito

**Preflight database positivo. Migrazione 27 non applicata al cloud; nessun merge o deploy Pages eseguito.**

Progetto verificato tramite elenco progetti e collegamento CLI: `pwa-docenti`, Ref `mwabfmooefmkszlrymyx`, stato `ACTIVE_HEALTHY`, PostgreSQL 17.11. Cloud con esattamente le prime **26 migrazioni** del repository, senza buchi o versioni estranee; repository con 27 migrazioni.

## Chiusura del confronto Auth / assessments

Il backup precedente alla migrazione 21 è stato ripristinato in PostgreSQL 17.11 isolato, senza rete e con dati in RAM. Le migrazioni 21–26 sono state applicate esclusivamente a quella copia per ricostruire lo stato atteso.

- `assessments`: una riga prima e dopo, identità della riga invariata, valori dei campi precedenti invariati. La copia migrata alla 26 coincide con il cloud. Le nuove colonne `grid_snapshot` e `grid_request_hash`, entrambe null sulla riga esistente, spiegano la differenza dell'impronta della riga completa rispetto alla versione 20.
- Auth: due account, nessuna aggiunta o rimozione. Rispetto al backup 20 cambia soltanto `auth.users.updated_at` in entrambe le righe. Hash password, email, ruolo, metadata, identificativi e tutti gli altri campi coincidono; identità e membership restano invariate. La riproduzione delle 21–26 non modifica alcun campo Auth.
- Il solo delta operativo `updated_at` non evidenzia modifiche alle credenziali o alle autorizzazioni. L'audit Auth non restituisce eventi utilizzabili nell'intervallo verificato: non viene attribuito a uno specifico login, refresh o attore senza evidenza.
- Il confronto finale con il nuovo backup26 dà **12/12 impronte canoniche coincidenti**, incluse accounts, identities, assessments, grades, observations, studenti, classi e iscrizioni.

Il confronto dati pendente è quindi completato. Non sono state usate password reali o modificati account/membership per questi controlli; un login interattivo di produzione da iPad resta una prova funzionale distinta.

## Controlli remoti non distruttivi

- **35/35** controlli di regressione superati con `scripts/verify-release26-remote.sql`. Rispetto al controllo storico della migrazione 20 viene aggiornata soltanto l'aspettativa della cronologia a 26; i controlli di sicurezza non sono allentati.
- Probe delle identità esistenti: isolamento workspace, profili propri e assenza di identità superati.
- Nessuna tabella pubblica senza RLS, nessuna vista pubblica senza `security_invoker`, nessuna relazione pubblica leggibile da anonimi.
- Vista compiti: lettura e isolamento per entrambi gli Owner, accesso anonimo negato.
- Directory docenti: controlli di catalogo e runtime superati. Non sono stati creati utenti Teacher/Viewer/Admin sul cloud; tali ruoli sono coperti dai test locali già eseguiti.
- Nessun indice applicativo invalido o non pronto; nessuna FK pubblica non validata; nessuna collisione rilevata con gli oggetti della 27.

Tutti i test cloud sono letture in transazioni READ ONLY/ROLLBACK. Conteggi finali: **2 account, 2 identità, 2 workspace, 2 membership, 25 studenti, 4 classi, 24 iscrizioni**. Tutte le impronte canoniche coincidono con il backup26 appena creato.

## Backup recuperabile aggiornato alla 26

```text
%LOCALAPPDATA%\QuadernoDocenti\Backups\pwa-docenti-20261024T174833Z-fbeda977
```

Cartella fuori da repository, OneDrive e directory pubblicate, ACL riservata all'utente Windows e SYSTEM. Dump completo, ruoli senza password database, Auth e identità con hash password, schema/dati/ACL/storia migrazioni, snapshot e diagnostica sensibile cifrati DPAPI CurrentUser. Integrità dell'archivio cifrato e decifrato verificata; inventario finale di 17 file verificato. Il backup precedente è conservato.

**Ripristino completo superato** su PostgreSQL 17.11 isolato senza rete o porte pubblicate, dati in RAM. Conteggi e impronte coincidono. Il container è stato rimosso. Script autonomo e istruzioni di recupero sono nella cartella privata.

Sulla sola copia ripristinata alla26 è stata poi applicata la migrazione27: **50 tabelle preesistenti** confrontate con conteggi e impronte invariati, escludendo soltanto le due nuove colonne nullable di provenienza delle lezioni; tre nuove tabelle orario vuote; **12/12 controlli di sicurezza superati**. Nessuna attività didattica creata automaticamente.

Limiti: decifratura legata allo stesso profilo Windows/chiavi DPAPI; copiare soltanto la cartella su un altro PC non basta. Non è una copia fuori sede. Configurazioni esterne Auth/provider/JWT/infrastruttura e payload Storage non sono coperti dal dump logico. Il recupero nel progetto originale presume conservata la configurazione gestita. Nessuna prova di restore è stata eseguita sul cloud.

## Sincronizzazione dispositivi

L'utente ha confermato durante questo preflight: **tutti i dispositivi 0 operazioni pendenti / 0 errori / 0 conflitti**. È una verifica effettuata dall'utente sui dispositivi, non una lettura remota delle code locali. Ripetere immediatamente prima di una futura applicazione; se nel frattempo vengono modificati dati, aggiornare baseline e backup.

## Dry-run definitivo e applicazione futura

Dry-run riuscito sul Ref autorizzato: unico file proposto `20261024000100_weekly_timetable.sql`, nessun seed o ruolo aggiuntivo. SHA-256 del file approvabile:

```text
1ae710006339784a5d3425f6e76542fd1be9b5ffcd349dd39bd3b175968339d6
```

Il comando seguente è **solo preparato e non è stato eseguito**. Richiede una nuova autorizzazione esplicita, nuova verifica 0/0/0, Ref corretto, cloud ancora a26 e dry-run limitato alla stessa27:

```powershell
node .\node_modules\supabase\dist\supabase.js db push --linked --project-ref mwabfmooefmkszlrymyx --skip-vault
```

Subito dopo un futuro deploy autorizzato: verificare 27/27 con `migration list`, eseguire `scripts/verify-timetable-remote.sql`, confrontare snapshot e dati preesistenti, verificare RLS/ACL e nuovi oggetti. Non usare seed/reset, `include-all`, riparazioni automatiche della cronologia o rollback distruttivi. La prova della 27 sulla copia non costituisce autorizzazione al deploy cloud.

## GitHub e pubblicazione

I file applicativi V1.5 sono committati nel commit `80e83651778cc63866786a5684ad0b3ce3da1329`; `HEAD` e `origin/dev` coincidevano prima degli aggiornamenti documentali di questo preflight. Nessuna modifica al frontend o alla migrazione27 è stata necessaria in questa verifica.

Il connettore GitHub aveva già restituito 403 alla creazione della PR. Come consentito dalla richiesta, usare il collegamento manuale [dev → main](https://github.com/pier31paolo93-svg/pwa-docenti/compare/main...dev?expand=1), preferibilmente in bozza. Nessun accesso alternativo al gestore delle credenziali è stato tentato. La richiesta di questo preflight non richiede di aggirare quel limite.

Prima del merge verificare la CI del commit esatto e la prova fisica iPad/iPhone di date, orari, tastiera e nuove funzioni. I precedenti risultati locali V1.5 restano: 85 unitari, 236 pgTAP, 69 SQL, 35 E2E Chromium, 2 E2E WebKit, 840 schermate per motore, typecheck/lint/build/PWA superati. Non sono nuovi test interattivi sul sito pubblicato in questa attività.
