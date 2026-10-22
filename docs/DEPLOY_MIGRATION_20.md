# Deploy autorizzato migrazione 20 — 22 ottobre 2026

**Applicata esclusivamente `20261022000400_workspace_teacher_directory.sql` al progetto pwa-docenti, Project Ref `mwabfmooefmkszlrymyx`. Cronologia verificata: 20/20. Nessun seed, reset, modifica di account/membership o deploy Pages. Nessun merge su main.**

## Prima e dopo

Prima dell'applicazione: branch dev al commit ff388c8, albero pulito; ref collegato esatto, progetto ACTIVE_HEALTHY; PostgreSQL 17.11; esattamente le 19 versioni precedenti con corrispondenza locale; nessuna funzione omonima. Il dry-run prevedeva solo il file 20, seeds=[] e roles=[].

SHA-256 del file autorizzato e applicato: `F13EE398B83F6362716E8EE7ACB384D048CD102A750FF79ACE210688A8FE3464`.

Comando usato dopo tutti i controlli:

```powershell
npx.cmd --no-install supabase db push --linked --project-ref mwabfmooefmkszlrymyx --skip-vault --yes
```

La CLI ha elencato e applicato soltanto il file 20. Nessun --include-all, --include-seed, --include-roles; --skip-vault ha escluso aggiornamenti dei segreti Vault. La cronologia successiva contiene esattamente 20 versioni, tutte corrispondenti ai file locali.

## Oggetto installato e autorizzazioni

Nuova funzione `public.workspace_teacher_directory(p_workspace uuid)`, PL/pgSQL STABLE, SECURITY DEFINER, search_path vuoto. Restituisce `user_id uuid, display_name text, member_role text` dei membri attivi owner/admin/teacher del workspace richiesto. Il chiamante deve essere Owner/Admin attivo di quel workspace; `private.member_role` verifica auth.uid(), membership non revocata e workspace non eliminato.

ACL effettiva remota: `postgres`, `service_role`, `authenticated` hanno EXECUTE; PUBLIC e anon no. service_role conserva il grant derivante dai default preesistenti, ma senza identità amministrativa autorizzata il controllo interno nega anche tale chiamata. Nessuna nuova chiave privilegiata è necessaria o aggiunta al frontend.

La funzione non legge auth.users o email. Le RLS di profiles rimangono attive e la policy SELECT resta `id = auth.uid()`. Il frontend mostra eventualmente solo la propria email già presente nella sessione; non recupera quella degli altri docenti.

Hash MD5 della definizione PostgreSQL normalizzata installata: `104836401c709e3d45ddfb5b37c9f674`, identico alla funzione locale sulla quale sono superati i test di tutti i ruoli. SHA-256 del file e MD5 della definizione sono due confronti diversi, non intercambiabili.

## Verifiche remote superate

**14 controlli di catalogo + 14 prove SQL di autorizzazione + 35 controlli di regressione**, tutti superati.

I 14 controlli di catalogo coprono cronologia, firma, STABLE, SECURITY DEFINER/search_path, privilegi effettivi, assenza di email/auth.users, gate Owner/Admin, filtri di membership e RLS profiles.

Le 14 prove runtime su due workspace esistenti sono eseguite in transazione READ ONLY con ROLLBACK, tramite ruolo PostgreSQL authenticated e impostazioni JWT locali alla transazione, senza conoscere password o creare sessioni/account:

- Per ciascuno dei due Owner: risultato identico ai soli membri autorizzati del proprio workspace; negazione dell'altro workspace, NULL, UUID inesistente e identità assente: 5 × 2 prove.
- Identità non appartenente, anche con claim applicativo admin, negata in entrambi i workspace: 2 prove.
- Ruolo anon negato dall'ACL; service_role senza identità amministrativa negato dal controllo: 2 prove.

Nessun nome, email o UUID degli utenti reali viene scritto nel report. La transazione ripristina ruolo e claim; le prove non aggiornano alcuna tabella. Non sono test end-to-end di login via PostgREST: verificano sul database installato la stessa identità usata dalle RLS.

**Limite esplicito di copertura:** nel cloud esistono soltanto due membership Owner; non esistono Admin, Teacher, Viewer o membership revocate. Non sono state create o trasformate membership, neppure temporaneamente. Lettura Admin e negazioni Teacher/Viewer/revocati sono state verificate nel preflight locale (112 pgTAP, inclusi 23 mirati alla directory, e 69 SQL) e con confronto esatto della definizione e dei filtri installati nel cloud. Non vengono presentate come chiamate remote di account di quei ruoli inesistenti.

I 35 controlli di regressione verificano PostgreSQL 17, migrazioni 20, colonne/FK/CHECK/indice delle funzionalità frontend, vista e relativi grant, RPC di sincronizzazione/importazione, RLS su tutte le tabelle pubbliche, integrità di vincoli/indici, account/Owner/membership invariati e AI disabilitata. Lo script conserva READ ONLY e ROLLBACK e solleva un errore se un controllo fallisce.

Script ripetibili: [verify-migration20-remote.sql](../scripts/verify-migration20-remote.sql) e [verify-migration20-regression.sql](../scripts/verify-migration20-regression.sql). Specificare sempre il progetto autorizzato nella CLI. I risultati positivi vengono emessi soltanto dopo il completamento senza errori delle asserzioni.

## Dati, account e schema invariati

Confrontate prima/dopo le impronte ordinate dei contenuti di **48 tabelle**: public, private, auth.users e auth.identities. Tutte identiche. Il contenuto è elaborato sul server; sono restituite soltanto impronte, senza righe applicative, email o credenziali.

Confermati **2 account Auth, 2 profili, 2 workspace, 2 membership Owner**. Nessuna membership aggiunta, revocata o cambiata. Nessun dato di studenti inserito/modificato, nessuna fixture o seed remoto.

Il confronto dello schema rileva soltanto la nuova funzione. Definizioni/ACL delle funzioni esistenti, tabelle/colonne, viste, indici, vincoli, trigger, policy RLS e grant preesistenti sono identici. L'unica modifica prevista alla cronologia è l'aggiunta della versione 20.

## Anomalie e stato del rilascio

Nessuna anomalia del deploy, dei dati o dei controlli remoti. Il controllo automatico ha respinto un comando preparatorio di regressione che rimuoveva le protezioni transazionali: non è stato eseguito. La verifica è stata completata con uno script che conserva READ ONLY/ROLLBACK e controlla ogni esito; nessuna autorizzazione aggiuntiva o correzione distruttiva è stata necessaria.

La documentazione e i due script vengono conservati con commit/push su dev. La verifica CI va riferita al nuovo commit, perché il push genera nuovi run. Esiti terminali e link dei run sono riportati nella PR #2 e nella consegna; i risultati del commit precedente non sostituiscono quelli del nuovo commit.

Il blocco SQL del selettore docenti è risolto. Restano separati l'autorizzazione al merge/rilascio e le prove PWA su dispositivi reali documentate in [MOBILE_UX](MOBILE_UX.md). Nessun merge, dispatch o pubblicazione GitHub Pages eseguiti.

Le prove grezze, prive di credenziali nei risultati, restano in `.local-test/m20-approved-*` (ignorato da Git). Non vengono pubblicati i contenuti o le impronte degli account dell'ambiente reale.
