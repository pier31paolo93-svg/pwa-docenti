# Architettura database
## Confini
Ogni dato scolastico appartiene a un workspace. auth.users è l'identità; profiles contiene il profilo; workspaces e workspace_members definiscono il tenant e i ruoli. Il trigger di registrazione crea sempre un workspace personale Owner, indipendentemente dall'ordine di registrazione. Il database non crea superamministratori applicativi.

Scuole e materie sono riutilizzabili nel workspace. Le classi appartengono a scuola e anno scolastico. Lo studente mantiene UUID stabile; enrollments rappresenta il suo storico per classe. La promozione o il trasferimento chiudono l'iscrizione e ne creano una nuova; non si riscrive la classe delle valutazioni storiche. class_subjects separa le materie della classe dai docenti assegnati in teaching_assignments.

Ogni tabella operativa ha UUID, workspace_id, created_by, visibility, created_at, updated_at, version, deleted_at. Le coppie (workspace_id,id) sono univoche e sostengono foreign key composite. I riferimenti alla classe nelle consegne, osservazioni e verifiche sono ridondanze controllate da FK composite: impediscono risultati per una classe diversa.

## Registro e storico
grade_entries è l'unico registro dei voti numerici. Risultati dei quesiti, rubriche e osservazioni non contengono un secondo voto finale. Unicità parziali impediscono più voti per la stessa origine, anche se cancellati logicamente. Un voto annullato si riattiva con nuova versione anziché crearne un duplicato.

La regola di conversione usa una curva monotona normalizzata (ascisse/ordinate 0..1), scala min/max e passo di arrotondamento. Il suggerimento non conferma il voto. In conferma di una verifica devono essere corretti tutti i quesiti foglia o tutti i criteri della rubrica. La correzione rapida usa bene=100%, così così=50%, male/non risposto=0%; le differenze didattiche restano nel dato originale.

Gli snapshot includono regola, categoria, tipo osservazione e risultati/rubrica disponibili; ogni revisione ha audit completo. La modifica dei punteggi della prova non riscrive automaticamente un voto confermato: occorre la conferma esplicita della revisione del voto con motivazione. Le viste usano la configurazione archiviata nel voto per la partecipazione alle medie.

## Cancellazioni e anagrafiche
Il client non ha hard DELETE. Le modifiche richiedono version+1; deleted_at genera tombstone. Anagrafiche aggiornabili, riferimenti conservati, nessun ON DELETE CASCADE sulle valutazioni. Usare archived_at per archiviare uno studente mantenendolo consultabile; deleted_at per cancellazione logica e sincronizzazione. La cancellazione logica di un genitore rende inaccessibili i discendenti tramite le policy: non usarla per chiudere l'anno scolastico.

Riferimenti e visibilità dei risultati storici sono immutabili. Per correggere un abbinamento errato annullare il vecchio dato e inserire quello corretto, senza spostare il voto in uno storico diverso.

## Migrazioni e operazioni
Vedere il modello dati per ordine e dipendenze. Nessuna migrazione crea un progetto cloud. config.toml descrive l'ambiente locale, non modifica automaticamente Auth cloud.

Indici: prefissi workspace, aggiornamento e UUID per sincronizzazione; unicità di dominio; indici FK aggiunti solo se non esiste un indice col prefisso corrispondente. Le viste aggregano il registro dopo RLS; non usano materializzazioni condivise.

Gli inviti Auth sono operazioni server amministrative; il client riceve solo chiave pubblica e JWT utente. Solo un Owner può aggiungere un utente già invitato a un workspace condiviso. Il cambio proprietario non è un'operazione esposta in fase 1.
