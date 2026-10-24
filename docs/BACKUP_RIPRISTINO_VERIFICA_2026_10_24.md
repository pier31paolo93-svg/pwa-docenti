# Backup e verifica di ripristino — 24 ottobre 2026

## Esito

Backup logico completo creato per Supabase `pwa-docenti`, Project Ref `mwabfmooefmkszlrymyx`. Ripristino integrale su PostgreSQL 17.11 isolato: **PASS**. Il cloud conserva **20 migrazioni**: nessuna migrazione applicata, nessun reset, seed o cancellazione sul cloud.

## Collocazione e protezione

Cartella privata, fuori dal repository, da OneDrive e dalle directory pubblicate:

```text
%LOCALAPPDATA%\QuadernoDocenti\Backups\pwa-docenti-20261024T102652Z-3ad58023
```

ACL senza ereditarietà, accesso riservato all'utente Windows corrente e SYSTEM. Archivio e snapshot sensibili cifrati tramite Windows DPAPI CurrentUser; nessuna copia sorgente in chiaro conservata. Integrità SHA-256 e decifratura verificate. `manifest.json` descrive il backup; `integrity.json` registra le impronte dei file.

**Limite di portabilità:** la decifratura richiede lo stesso profilo Windows e le relative chiavi DPAPI. Copiare soltanto la cartella su un altro computer o account non garantisce il recupero. Conservare il profilo e le chiavi; un'eventuale copia portabile cifrata o esterna richiede una preparazione separata. Questa copia locale non costituisce un backup fuori sede.

## Contenuto

- Dump PostgreSQL completo in formato custom: schema, dati applicativi, dati Auth, proprietari, privilegi, cronologia migrazioni e schemi non di sistema.
- Definizioni originali dei ruoli e membership, senza password dei ruoli database.
- Account Auth e identità, inclusi gli hash delle password necessari al recupero; nessuna password in chiaro richiesta o riportata.
- Snapshot cifrati prima e dopo il backup, con tutte le 24 iscrizioni: identificativi, collegamenti, numero di registro, date, esiti, versione e timestamp. Conservata anche la previsione dei numeri assegnati dalla migrazione 21.
- Script autonomo `restore-isolated.ps1`, query di verifica, copia della migrazione 21 destinata alla sola prova e istruzioni `RECOVERY_README.txt`.

Il backup logico non comprende configurazione esterna dei provider Auth, segreti JWT, configurazione infrastrutturale del progetto o contenuti binari Storage. Il recupero nel progetto originale presuppone la conservazione della relativa configurazione gestita. Non è stato tentato un login con le password reali.

## Prova di ripristino

Ripristino completo e transazionale con arresto al primo errore, su PostgreSQL **17.11** in container temporaneo senza rete né porte pubblicate, con dati in RAM. Locale ICU `en-US`, versione `153.121`, coerente con la sorgente. Il container è stato rimosso al termine.

Per riprodurre i ruoli gestiti di Supabase nel PostgreSQL isolato sono stati adattati soltanto il grantor delle membership e, temporaneamente, gli attributi del ruolo postgres durante il ripristino degli event trigger. Gli attributi originali sono stati ripristinati dopo il caricamento. I file originali cifrati e il database cloud sono rimasti invariati.

| Entità recuperata | Conteggio | Confronto con origine |
| --- | ---: | --- |
| Account Auth | 2 | Coincidente, inclusi hash password |
| Identità Auth | 2 | Coincidente; nessuna identità orfana |
| Workspace | 2 | Coincidente |
| Membership | 2 | Coincidente |
| Studenti | 25 | Coincidente |
| Classi | 4 | Coincidente |
| Iscrizioni | 24 | Coincidente |

Coincidono anche le impronte dei profili, voti, osservazioni e valutazioni, i metadati RLS, le versioni delle estensioni e la cronologia delle 20 migrazioni. La verifica finale in sola lettura conferma lo stato cloud invariato rispetto al backup.

## Prova della migrazione 21 sulla copia

La migrazione `20261023000100_register_numbers.sql` è stata eseguita **esclusivamente sul ripristino isolato**.

- 24 numeri di registro assegnati, tutti corrispondenti alla previsione conservata.
- Zero numeri mancanti e zero duplicati negli ambiti previsti dalla migrazione.
- Versione incrementata una sola volta per ciascuna delle 24 iscrizioni.
- Identificativi, collegamenti, date, esiti e informazioni didattiche delle iscrizioni invariati.
- Impronte delle altre entità controllate invariate.

Questa prova verifica la migrazione 21 sui dati recuperati; non equivale all'applicazione delle migrazioni 21–26 sul cloud.

## Confronto previsto dopo un futuro deploy autorizzato

Confrontare le 24 iscrizioni con lo snapshot cifrato: gli unici cambiamenti attesi dalla migrazione 21 sono `register_number`, incremento di `version` e aggiornamento di `updated_at`. Tutti gli altri campi esistenti, compresi identificativi, collegamenti, date ed esiti, devono coincidere. Verificare unicità e corrispondenza dei numeri alla previsione.

Confrontare conteggi e impronte di account, identità, profili, membership, workspace, studenti, classi e informazioni didattiche. Eventuali nuove colonne introdotte dalle migrazioni successive vanno valutate separatamente dai valori preesistenti. Verificare la cronologia completa attesa, le nuove RPC, RLS e isolamento workspace dopo l'eventuale applicazione autorizzata delle sei migrazioni.

In caso di discrepanze interrompere le operazioni e analizzare il confronto: nessun ripristino distruttivo automatico sul cloud. Un ripristino completo richiede un piano e un'autorizzazione dedicati.

## Sincronizzazione dispositivi

Il 24 ottobre 2026 l'utente ha confermato esplicitamente di aver verificato tutti i telefoni/iPhone e iPad utilizzati: **0 operazioni in attesa, 0 errori, 0 conflitti** per ciascun dispositivo. È una verifica dichiarata dall'utente sul dispositivo, non un controllo remoto delle code locali. Ripetere il controllo immediatamente prima del futuro deploy, evitando nuove modifiche durante la finestra di manutenzione.

## Stato finale

Backup e ripristinabilità verificati nei limiti descritti. Migrazioni cloud ancora **20**, nessuna modifica agli account o ai dati cloud. Applicazione delle migrazioni ancora in attesa di autorizzazione esplicita.
