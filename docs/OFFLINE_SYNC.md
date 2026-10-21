# Contratto offline — versione 1
## Push
RPC sync_mutation(p_operation UUID, p_table TEXT, p_id UUID, p_workspace UUID, p_expected_version BIGINT, p_patch JSONB).

- UUID del record e dell'operazione possono essere generati sul dispositivo.
- Creazione: expected_version=0, campi applicativi nel patch; autore derivato da auth.uid().
- Aggiornamento: expected_version uguale alla revisione letta; il server blocca la riga e scrive version+1.
- Cancellazione: patch con deleted_at in ISO 8601; non eseguire DELETE.
- Patch esclude id, workspace_id, created_by, created_at, updated_at, version e calculation_snapshot.
- Ogni invocazione è atomica, una riga per operazione. Per registrazioni di classe utilizzare una coda di operazioni, un UUID stabile per ogni studente. I dati dipendenti si inviano dopo i genitori.
- Lo stesso utente può ritrasmettere lo stesso operation_id e payload ricevendo il risultato originario. Parametri differenti con lo stesso ID producono SQLSTATE 22023.
- Le operazioni concorrenti sullo stesso operation_id sono serializzate tramite advisory lock; quelle sulla riga tramite FOR UPDATE.
- I tentativi falliti sono annullati e non registrati come successi.

La deduplicazione è memorizzata in private.sync_operations, chiave (actor_id,operation_id), RLS e nessuna modifica dal client. Non eliminarne le righe senza una politica di scadenza della coda offline: in fase 1 la conservazione è illimitata. I retry ricontrollano l'accesso attuale alla riga prima di restituire il risultato storico.

## Errori e risoluzione
- 40001: revisione obsoleta. Rileggere la riga autorizzata; mostrare differenze e richiedere una scelta esplicita. Unire solo i campi approvati, nuova operation_id e versione corrente.
- 42501: operazione non autorizzata, risorsa non accessibile, campo protetto o ruolo revocato. Non ritentare indefinitamente.
- 23503/23514/23505: riferimento, vincolo o duplicato. Correggere la richiesta; una nuova operazione descrive una modifica differente.
- Esito positivo: salvare la riga server soltanto se la sua versione non è più vecchia di quella già in IndexedDB.

Anche DML diretto richiede NEW.version=OLD.version+1: una scrittura con revisione obsoleta non passa il trigger. L'idempotenza è garantita tramite RPC, non per inserimenti DML generici.

## Pull e cache autorizzata
Il client legge le tabelle via Supabase con RLS, includendo deleted_at; non filtrare i tombstone. Paginare con chiave UUID e limite massimo 1000, una tabella alla volta e sempre nel workspace selezionato.

updated_at è utile per aggiornamenti frequenti con finestra sovrapposta, ma **non è un cursore commit affidabile**: una transazione lunga può terminare dopo aver assegnato un timestamp precedente. In fase 1 è obbligatoria una riconciliazione completa periodica e a ogni accesso/ripresa, con pagine ordinate per id, deduplica per UUID/versione e scansioni successive per convergenza. Non usare un watermark esclusivo su updated_at come unica fonte.

Ogni scansione completa completata identifica i record ancora leggibili; eliminare dalla cache autorizzata quelli non più presenti (revoche o cancellazioni dei genitori). Non cancellare righe locali con modifiche pendenti: spostarle in conflitto fino a risoluzione. Se una scansione fallisce, non trattare le pagine mancanti come cancellazioni.

L'autorizzazione può cambiare offline: alla riconnessione le RPC la rivalutano; al logout eliminare tutte le cache personali e sospendere la coda. Impostare una scadenza locale per la consultazione sensibile. La strategia non promette una fotografia atomica multi-tabella o sincronizzazione realtime; se necessarie serviranno una fase successiva con feed di commit/cursori appropriati.
