# V1.5 — Orario settimanale

Aggiornamento rilascio: [preflight definitivo produzione](PREFLIGHT_PRODUZIONE_V1_5_2026_10_24.md) completato con backup recuperabile alla26 e chiusura del confronto Auth/assessments. La migrazione27 resta non applicata al cloud. Il piano originale sotto è integrato dagli esiti del nuovo report.

## Funzioni

Organizzazione → Orario settimanale gestisce versioni provvisorie/definitive, bozza/attivo/archiviato, docente autorizzato, annualità e validità. Una versione comprende le scuole delle assegnazioni del docente: il filtro Scuola restringe gli slot visualizzati, senza duplicare gli orari per scuola o consentire sovrapposizioni tra scuole.

Tablet/desktop mostrano una matrice giorno/fascia con celle estese per ore consecutive e fasce ricavate liberamente dagli slot. Su telefono si usa un elenco giornaliero senza scorrimento orizzontale obbligatorio; domenica è opzionale. Durate espresse in minuti e ore da 60 minuti. Classe, materia e scuola derivano dall'assegnazione docente canonica; non vengono ricreate associazioni implicite. Le materie proposte appartengono soltanto alle assegnazioni autorizzate per classe/anno/docente.

Le bozze permettono inserimento, modifica, duplicazione e rimozione logica degli slot. Le versioni pubblicate mantengono il modello storico: per modifiche future si duplica una settimana, si cambia la decorrenza e si conferma l'attivazione. L'attivazione può chiudere esplicitamente una versione precedente il giorno prima della nuova decorrenza; nessun cambio implicito di periodo. I periodi terminati con data fine possono essere archiviati conservando le ricorrenze storiche.

Eccezioni datate: annullamento, uscita, sostituzione, aula/laboratorio, scambio, riduzione, attività straordinaria e aggiuntiva. Si rimuovono logicamente; se una variazione ripristinerebbe sovrapposizioni viene rifiutata. Per uno scambio si annullano prima gli slot originari e si inseriscono le sostituzioni. Non è una transazione unica che modifica l'intera giornata; ogni variazione è validata sullo stato effettivo. Le variazioni già collegate a lezioni registrate non possono riscrivere quello storico.

Dashboard: “Le mie lezioni di oggi”. Registro lezioni: scelta della giornata prevista. Registro rapido: proposte della giornata, slot unico proposto come predefinito alla prima apertura, scelta esplicita quando gli slot sono più di uno e collegamento con data/assegnazione/orario. Il normale editor lezione rimane disponibile per modifiche manuali. Nessuna scelta viene fatta in base alla sola ora corrente.

Calendario: ricorrenze calcolate soltanto nell'intervallo visualizzato, con annullamenti e variazioni. Le lezioni già registrate sono mostrate come eventi canonici; lo slot corrispondente non viene duplicato visivamente. Un'apertura dello slot non crea voti, compiti o osservazioni. La creazione della lezione è una richiesta esplicita; retry della stessa occorrenza riaprono la stessa lezione. Anche una lezione preesistente con assegnazione e intervallo identici viene riutilizzata.

Passaggio anno: collegamento facoltativo alla copia dell'orario precedente dopo l'operazione. Si confermano anno destinazione, docente e ogni nuova assegnazione; il server verifica il rimappamento e crea una bozza, senza copiare eccezioni né attivarla automaticamente.

## Database: migrazione 27

`20261024000100_weekly_timetable.sql` crea:

- `timetable_versions`: anno, docente, tipo, stato, validità, autore/versionamento e timestamp.
- `timetable_slots`: versione, assegnazione canonica, giorno ISO, orari, tipologia, aula e note.
- `timetable_exceptions`: data, slot opzionale, variazione e valori sostitutivi.
- Due colonne nullable in `lessons`: `timetable_occurrence_id` e `timetable_occurs_on`, indice univoco e trigger di validazione della provenienza. Nessun aggiornamento di contenuti o timestamp delle lezioni preesistenti; una fingerprint della riga completa cambia per l'aggiunta delle nuove colonne null.
- RPC invoker `activate_timetable`, `duplicate_timetable`, `register_timetable_lesson`; helper/trigger privati con `search_path` vuoto e privilegi limitati.

Nessuna modifica alle migrazioni 1–26, agli account, alle iscrizioni, ai voti, alle policy delle altre tabelle o alla whitelist delle mutazioni offline. Le scritture orario usano un percorso online dedicato e versionato.

RLS: Owner/Admin nel proprio workspace; Teacher soltanto per le proprie versioni, con assegnazioni proprie dello stesso anno. Viewer, anonimi, membri revocati e altri workspace esclusi. Nessuna query frontend a `auth.users`; directory docenti riutilizzata soltanto per amministratori autorizzati. Hard delete non concesso.

Vincoli e trigger verificano intervalli completi, validità entro annualità, assegnazioni, sovrapposizioni settimanali/effettive, provenienza delle lezioni e conservazione dello storico. Lock advisory transazionali per workspace/docente serializzano attivazione, slot e variazioni; il modello viene riletto dopo l'acquisizione del lock. `version` impedisce sovrascritture da editor obsoleti. Le attivazioni/copie sono transazionali e un errore lascia invariato lo stato dell'operazione.

## Offline

L'orario sincronizzato viene conservato mediante il vault cifrato esistente, separato per utente/workspace e solo con consenso alla copia locale. È disponibile dopo reload offline con il service worker di produzione. La UI segnala la copia potenzialmente non aggiornata. Senza copia preventivamente sincronizzata non si può ricostruire l'orario dal cloud offline.

Scritture di bozze, eccezioni, copie e attivazioni richiedono connessione. Non sono inserite nella coda generica, perché l'attivazione richiede controlli concorrenti sul server. Preparazione offline di nuove bozze non implementata: scelta esplicita per preservare i controlli del modello esistente.

## Verifiche locali

- Cloud verificato prima dello sviluppo: 26 migrazioni, ultima `20261023000600`; Project Ref esplicito `mwabfmooefmkszlrymyx`.
- Dry-run: soltanto `20261024000100_weekly_timetable.sql`; nessun seed, ruolo o altra migrazione.
- 85 test unitari, inclusi 9 per ricorrenza, giorno Europe/Rome/DST, durata, filtri, versioni, annullamenti, aggiunte e riuso delle lezioni.
- 236 pgTAP, inclusi 44 nuovi controlli di vincoli, permessi, Teacher/Viewer/Admin, revoca, conflitti, retry, passaggio anno e conservazione lezioni.
- 69 SQL locali e lint PostgreSQL public/private superati.
- Replay integrale delle 27 migrazioni su un database PostgreSQL 17 temporaneo vuoto, senza seed/reset: superato; rimosso soltanto quel database temporaneo.
- 35 E2E Chromium superati: 33 regressioni esistenti e 2 nuovi flussi dell'orario/fallback schema assente.
- 2 E2E specifici WebKit superati, con screenshot desktop/tablet/telefono e campi data/ora nativi.
- Typecheck e build di produzione superati. Restano gli avvisi preesistenti su chunk grandi e import dinamico di `gridReports` inefficace; nessun errore di compilazione.
- PWA produzione: service worker, manifest, reload offline dell'orario cifrato, coda/sincronizzazione, aggiornamento e assenza di risposte personali nella Cache API superati.
- Audit Chromium: 840 schermate alle larghezze 320/375/390/768/820/834/1024/1180, zero violazioni geometriche rilevate.
- Audit WebKit: 840 schermate alle stesse larghezze, zero violazioni geometriche rilevate.

`scripts/verify-timetable-remote.sql` prepara 12 controlli di catalogo/privilegi e probe runtime delle identità esistenti, in transazione read-only. Si esegue sul cloud soltanto dopo il deploy autorizzato della 27; non crea account o fixture e non restituisce dati personali.

Screenshot fittizi locali in `.local-test/v15-screenshots/`; audit e log in `.local-test/v15-*`, esclusi dal repository. La CI conserva gli screenshot come artefatti e riesegue anche gli E2E orario WebKit tramite `npm run test:e2e:webkit`.

La verifica WebKit automatizzata non sostituisce una prova su iPad fisico di selettore data/ora, tastiera virtuale, orientazione e installazione PWA.

## Piano di rilascio e limiti

1. Revisionare la PR dev → main e completare il precedente collaudo remoto sospeso per differenze Auth/assessments e test storici con conteggi obsoleti; V1.5 non risolve tali anomalie.
2. Prima di qualsiasi deploy database: nuova conferma delle code offline su tutti i dispositivi, backup recuperabile aggiornato alla versione 26 e confronto baseline. Ricontrollare Ref e cronologia esatta 26, poi dry-run della sola 27.
3. Solo dopo autorizzazione esplicita applicare la 27 senza seed/reset. Verificare 27/27, schema/RLS/ACL, dati preesistenti, RPC e letture autorizzate; nessun fixture reale o account docente aggiunto automaticamente.
4. Il frontend attuale resta compatibile: nuove strutture additive e provenienza nullable. La nuova UI mostra un messaggio circoscritto se la migrazione manca.
5. Merge e pubblicazione Pages soltanto dopo approvazione e CI verde. Prova docente su iPhone/iPad, creazione di una bozza, anteprima, attivazione controllata e verifica lezione/variazione.
6. In caso di errore fermarsi. Preferire una correzione incrementale autorizzata; non eliminare tabelle/colonne che contengono nuovi orari o provenienze. Nessun down distruttivo automatico. Un eventuale ripristino richiede piano e autorizzazione dedicati.

Nessuna modifica cloud, nuovo merge o pubblicazione eseguiti in questa attività. La copia offline può essere obsoleta fino alla successiva sincronizzazione; l'attivazione non verifica festività esterne e le eccezioni vanno inserite esplicitamente.
