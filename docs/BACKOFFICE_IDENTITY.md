# Organizzazione, selezione docente e identità visiva

## Modifiche frontend

La sezione Organizzazione usa un ordine esplicito, identico nel DOM e nelle griglie desktop/tablet/smartphone: Anni scolastici → Scuole → Materie → Classi → Classi / Materie → Assegnazioni docenti → Studenti → Iscrizioni. Restano i filtri di autorizzazione preesistenti: gli incarichi amministrativi sono mostrati a Owner/Admin. Nessuna relazione del database modificata.

Assegnazioni docenti utilizza ricerca per nome e, quando autorizzata/disponibile, email, seguita da selezione nativa accessibile anche da tastiera e sui dispositivi mobili. Il valore inviato rimane il teacher_id UUID. I nomi uguali sono distinti per ruolo e posizione stabile ordinata per UUID interno; nessun UUID è mostrato nelle etichette, nella tabella incarichi o nell'export. In assenza di nome compare «Profilo senza nome»; per un riferimento storico non più disponibile compare «Docente già assegnato · riferimento conservato».

L'email disponibile è esclusivamente quella dell'utente corrente, letta dalla sua sessione Supabase Auth. Lo schema profiles non contiene email: le email degli altri membri non vengono recuperate, inferite o esposte. Ricerca e visualizzazione di tali email rimangono quindi indisponibili. Non esiste alcuna interrogazione di auth.users nel nuovo codice, nemmeno nella RPC.

La query è separata per account/workspace e non entra nella cache offline cifrata. Nuovi incarichi richiedono una selezione UUID presente nella directory autorizzata; caricamento/errore impediscono la creazione. Gli incarichi esistenti mantengono riferimenti immutabili, secondo i trigger già presenti: il teacher_id non viene riscritto. Quando manca la RPC, l'app segnala indisponibilità e blocca soltanto la nuova selezione; consultazione e riferimenti storici rimangono disponibili. Gli altri flussi non dipendono dalla nuova RPC.

## Migrazione 20 — deploy cloud autorizzato completato

File: `20261022000400_workspace_teacher_directory.sql`. **Applicato al cloud il 22 ottobre 2026 dopo autorizzazione esplicita, sul solo progetto pwa-docenti: 20/20 migrazioni. Nessun reset, seed o modifica di dati/account/membership.** Risultati e limiti di copertura: [DEPLOY_MIGRATION_20](DEPLOY_MIGRATION_20.md).

La migrazione aggiunge soltanto la funzione read-only `public.workspace_teacher_directory(p_workspace uuid)`, con risultato user_id, display_name, member_role. SECURITY DEFINER con search_path vuoto è necessario perché la policy profiles esistente permette di leggere direttamente solo il proprio profilo. Prima di qualsiasi lettura la funzione verifica il ruolo dell'attore con private.member_role: solo Owner/Admin attivi del workspace richiesto; altri ruoli, membership revocate, workspace estranei/non disponibili vengono negati con 42501.

Il join restituisce esclusivamente membership attive di quel workspace con ruolo owner/admin/teacher; viewer e revocati non sono candidati. Non legge auth.users o email. EXECUTE revocato a PUBLIC/anon e concesso ad authenticated, con controllo del workspace dentro la funzione. Nessuna modifica a tabelle, FK, indici, trigger, policy RLS o funzioni esistenti; le prime 19 migrazioni restano inalterate. Le RLS e i vincoli delle RPC di scrittura preesistenti restano l'ultima difesa dei salvataggi.

Il dry-run e il deploy della sola migrazione 20 sul progetto pwa-docenti, ref mwabfmooefmkszlrymyx, sono completati con verifiche remote positive. Il blocco SQL del selettore è risolto; merge e pubblicazione frontend richiedono ancora l'autorizzazione dell'utente e CI positiva.

## Asset originali e aggiornamento PWA

Originale fornito dall'utente conservato senza modifiche in `assets/branding/quaderno-docenti-original.png`. `node scripts/generate-brand-icons.mjs` produce con Sharp soltanto ridimensionamenti proporzionati/padding, senza ritaglio, ridisegno o logo alternativo:

- icon-192.png 192×192 e icon-512.png 512×512;
- icon-maskable-512.png 512×512, artwork intero 286×286 centrato su fondo pastello: ogni angolo rientra nel cerchio sicuro centrale di diametro 80%;
- apple-touch-icon.png 180×180;
- favicon-16.png, favicon-32.png e favicon.ico con PNG 32×32 incorporato.

Manifest, HTML, marchio login/sidebar e precache utilizzano questi asset; il vecchio icon.svg è rimosso. Base/id/start_url/scope della PWA restano /pwa-docenti/. Il service worker aggiorna le revisioni delle risorse statiche e pulisce le cache obsolete; nessuna cache delle risposte Auth/REST introdotta. I PNG principali e la variante maskable sono stati ispezionati visivamente: proporzioni conservate, nessuna parte del disegno tagliata. Alle dimensioni favicon il testo dell'originale è naturalmente molto piccolo.

Al rilascio aggiornare la PWA tramite il pulsante Aggiorna e riaprirla. Android può aggiornare l'icona con ritardo; iOS può mantenere la vecchia Apple Touch Icon. Se l'icona resta precedente, può essere necessario rimuovere e aggiungere nuovamente la PWA alla schermata Home. **Prima sincronizzare tutte le modifiche in coda**: rimuovere l'app può eliminare dati locali non sincronizzati e richiedere un nuovo login/consenso offline. Nessuna reinstallazione è richiesta per usare il sito nel browser. Il comportamento sui dispositivi iOS/Android reali resta da verificare dall'utente.

## Verifiche

Sono aggiunti test unitari per ordine menu, ricerca nome/email autorizzata, UUID, omonimi, errore directory e riferimenti storici; browser per le tre dimensioni, creazione incarico con UUID corretto, isolamento RPC/email e backend non ancora aggiornato; 13 pgTAP mirati per ACL, Owner/Admin, teacher/viewer, revoca, isolamento e RLS profiles invariata. Il controllo dell'artefatto verifica anche dimensioni delle icone, manifest maskable, favicon e geometria dell'area sicura.

Il collaudo locale completo è **superato**: 26 unitari, 15 scenari browser, 102 pgTAP e 69 SQL, lint, PWA e build di produzione. Precache: 28 risorse, circa 3,5 MiB; resta il warning preesistente non bloccante sul chunk dinamico ExcelJS. Per pgTAP backend/SQL sono usate copie ignorate che limitano le sole asserzioni di conteggio ai due workspace del seed già esistente: nessun reset o cancellazione degli ulteriori account E2E. Le fixture sono interamente fittizie e le modifiche dei test SQL vengono annullate con ROLLBACK. I risultati finali e i check GitHub del commit sono riportati nella PR.

Nel collaudo browser è stato corretto il selettore del test della classe/materia: il confronto esatto del nome accessibile era troppo rigido perché l'etichetta nativa includeva le opzioni. Il test isolato dell'incarico è poi passato e la suite è stata ripetuta a file stabilizzati. Nessuna password reale, dato di studenti reali o chiave privilegiata è stato usato o aggiunto al repository. Non è stato modificato main né avviato il deploy Pages.
