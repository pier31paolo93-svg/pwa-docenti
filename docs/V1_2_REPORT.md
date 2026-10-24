# Quaderno Docenti V1.2 — implementazione e preparazione rilascio

Data del collaudo: 23 ottobre 2026. Branch di lavoro: `dev`.

## Perimetro e stato cloud

Progetto autorizzato: **pwa-docenti**, Ref **mwabfmooefmkszlrymyx**.
Il cloud conserva le **20 migrazioni preesistenti**. In questa attività sono state eseguite soltanto letture della cronologia e `supabase db push --linked --dry-run --skip-vault`.
Nessun deploy SQL remoto, seed remoto, reset remoto, modifica di account/membership reali, merge o pubblicazione Pages.
La prima analisi del repository ha rilevato PR #2 già unita dall'utente: `origin/main` era `53832c8`, con albero uguale a `dev` `5078633`. Le nuove modifiche partono da quell'albero; non riscrivono i lavori precedenti.

## Funzionalità implementate

### Backoffice, registro e iscrizioni

- Campi data/ora con dimensioni compatibili con Safari/WebKit, griglia form adattiva e riferimenti storici spiegati nel modulo.
- `enrollments.register_number`: intero positivo univoco nella classe; la classe appartiene già a un anno. Numerazione iniziale deterministica per cognome, nome e UUID, assegnata solo alle righe senza numero. Il server assegna il primo numero libero sotto lock e non rinumera i valori esistenti.
- Numeri conservati anche sulle iscrizioni chiuse; le righe eliminate logicamente non occupano il numero. Un ripristino con numero già occupato richiede una scelta esplicita.
- Ordinamento condiviso per numero, cognome, nome, UUID; numeri legacy mancanti indicati esplicitamente. Selettori alternativi cognome/nome nelle anagrafiche e nella correzione griglie.
- Iscrizione: classe prima dello studente, selezione studente disabilitata finché manca la classe, ricerca nome/cognome/codice, esclusione delle iscrizioni già presenti nella stessa classe anche se chiuse o archiviate. Il vincolo storico richiede il ripristino della riga archiviata invece di un duplicato. Un'altra annualità resta associabile tramite la sua diversa classe.
- Gli identificativi delle associazioni storiche restano protetti; gli altri campi sono precompilati, modificabili e validati. Le date di iscrizione non possono escludere attività didattiche già registrate.

### Passaggio anno

Percorso **Organizzazione → Passaggio anno**, riservato a Owner/Admin e disponibile online.
Il wizard seleziona anni/scuola/classi, propone esiti massivi o individuali, permette ricerca, destinazioni nuove/esistenti, accorpamenti/suddivisioni, numeri, copia delle materie e conferma individuale dei docenti autorizzati.
La proposta riconosce la cifra iniziale 1–5; nomi diversi richiedono destinazione manuale. Dopo la quinta non propone una sesta.

La RPC di anteprima non scrive dati. L'applicazione è una transazione unica, ricontrolla versioni e autorizzazioni sotto lock, crea solo le nuove righe richieste, chiude logicamente l'origine e registra l'operazione. Lo stesso UUID con lo stesso payload restituisce il risultato già applicato; payload differenti sono rifiutati. Gli studenti da definire restano aperti nell'anno precedente. Trasferiti, ritirati e diplomati non ricevono iscrizioni fittizie. Nessuna operazione di passaggio entra nella coda offline.

### Griglie universali

Percorso **Griglie universali**, disponibile dal menu e da Organizzazione/Valutazione.

- Quattro basi Matematica Algebra/Biennio, con o senza argomentazione: 20/30/30/20 = 100 oppure 20/30/30 = 80.
- **I descrittori originali non erano disponibili**: non sono stati inventati. I testi vuoti sono segnalati e si possono completare con testi originali forniti dalla docente o con descrittori personali.
- Modelli personali/condivisi, duplicazione, modifica, archiviazione/ripristino. Archiviare un modello usato conserva la leggibilità delle verifiche storiche; eliminarlo logicamente è bloccato.
- Sezioni, esercizi, sottocriteri, competenze, massimali, quattro livelli e intervalli modificabili. Controllo delle somme per criterio/esercizio/sezione/prova e dei budget per competenza.
- Distribuzione automatica con resto e precisione da zero a tre decimali. Il frontend usa millesimi interi per le somme dei punti; PostgreSQL usa `numeric`.
- Snapshot immutabile della struttura, dei massimali e della versione della regola nella verifica. Gli UUID dei quesiti sono rigenerati in modo deterministico per ogni prova: il riuso del modello non collide con prove precedenti.
- Conversione lineare oppure fasce configurabili con soglia inferiore inclusiva e superiore esclusiva. La base di normalizzazione delle fasce è esplicita; 37,999 e 38 non lasciano intervalli scoperti. Le curve legacy restano disponibili.
- Correzione rapida per totale esercizio oppure analitica per sottocriteri: **un solo punteggio canonico** in `question_results`. Il server somma i dettagli analitici; il punteggio rapido non genera competenze inventate.
- Su smartphone, navigazione esercizio/studente; salvataggio senza uscire, avanzamento, proposta provvisoria e gestione delle bozze. Il salvataggio dei punteggi riusa cache/coda cifrata, versioni e conflitti esistenti. Creare la prova richiede connessione.
- Conferma del voto attraverso `grade_entries` e audit esistenti, con riepilogo esplicito anche su desktop. Un voto confermato rimane invariato finché il docente non esegue una nuova conferma motivata.
- Evidenze di competenza in dashboard, statistiche e scheda studente, con segnalazione dei dettagli mancanti. Medie e storico dei voti continuano a usare il registro canonico.

### Esportazioni

PDF A4 vuoto, individuale compilato, riepilogo classe e competenze disponibili; CSV/XLSX riusano i servizi esistenti.
Il PDF vuoto non include nominativi o correzioni. Font DejaVu Sans incorporato con licenza distribuita in `public/fonts/`, supporto ad accenti, lettere greche e simboli matematici comuni. Il font è una risorsa statica precache della PWA; nessun font viene richiesto a servizi esterni.
Prova di stress con descrittori lunghi su quattro pagine A4, rendering e controllo dei margini. Le righe vengono mantenute insieme quando entrano in una pagina e le intestazioni vengono ripetute.

## Migrazioni incrementali da autorizzare

| N. | File | Modifiche |
|---|---|---|
| 21 | `20261023000100_register_numbers.sql` | Colonna/constraint/indice del numero di registro, trigger di allocazione e protezione riferimenti/date, backfill deterministico, esiti `graduated` e `pending`. Il backfill incrementa la versione delle iscrizioni numerate. |
| 22 | `20261023000200_year_transition.sql` | Audit append-only `year_transitions`, RLS di lettura per l'autore Owner/Admin, RPC anteprima/applicazione e validazione privata. Nessun passaggio anno viene eseguito dalla migrazione. |
| 23 | `20261023000300_universal_grids.sql` | Estensioni JSON delle rubriche/prove/risultati, posizione quesiti, archiviazione modelli, regole lineari/fasce/sufficienza; validatori, RPC creazione prova, snapshot voto e vista `security_invoker` delle competenze. Nessun registro parallelo. |

Le funzioni private non sono eseguibili dai client. Le RPC pubbliche revocano `PUBLIC`/`anon`; il passaggio richiede Owner/Admin e la creazione prove richiede un ruolo scrivente e le policy esistenti. La vista competenze concede soltanto SELECT ad `authenticated` e usa RLS delle sorgenti. Nessuna interrogazione di `auth.users` è stata aggiunta al frontend.

## Collaudo e riproduzione

Solo dati fittizi, PostgreSQL locale **17.11**. Le nuove migrazioni sono state applicate esclusivamente allo stack locale senza cancellare le fixture esistenti.

| Verifica | Esito locale |
|---|---|
| Vitest | **56/56** |
| pgTAP, incluse regressioni e V1.2 | **153/153** |
| SQL di integrazione storico | **69/69** |
| Writer concorrenti | A preservato, B obsoleto rifiutato con **40001** |
| Playwright | **27/27**: 24 regressioni + 3 V1.2; correzione online/offline, PDF, anteprima e iscrizioni |
| Lint SQL | Nessun errore/avviso |
| TypeScript e build produzione | Superati |
| Configurazione rilascio | 5 controlli superati; Ref/chiave/variabili frontend verificati |
| PWA produzione | Manifest, scope, service worker, reload offline, coda, sincronizzazione e aggiornamento verificati |
| PDF | Quattro tipi A4 + stress multipagina; margini verificati e rendering ispezionato |

`supabase test db` esegue i cinque file pgTAP; `npm test`, `npm run test:e2e`, `npm run build`, `npm run test:pwa` verificano il resto. `scripts/audit-responsive.cjs` usa soltanto fixture locali e supporta `--webkit`.
I tre conteggi globali del seed storico sono stati delimitati ai suoi due workspace: consentono la convivenza con le fixture browser senza eliminare dati o indebolire le verifiche RLS.
La CI della PR ricostruisce inoltre il database locale da zero due volte per verificare l'intera catena delle migrazioni. I reset della CI riguardano solo container effimeri del runner, mai il cloud.

## Verifica responsive e schermate

Larghezze: **320, 375, 390, 768, 820, 834, 1024, 1180**.
Baseline Chromium: 672 schermate. L'audit esteso include 36 risorse, moduli, pagine principali e tutti i passaggi dei due nuovi wizard: **744 schermate per motore**. Report JSON completi in `.local-test/mobile-audit/`; la CI conserva quelli Chromium e WebKit come artifact della PR.
Gli audit finali Chromium e WebKit sono entrambi superati: **0 overflow, 0 campi sotto 140 px, 0 target sotto 44 px e 0 dialoghi tagliati**. [Riepilogo macchina con hash delle migrazioni](V1_2_VALIDATION.json).

- [iPad prima](images/v1.2/ipad-before.png) / [iPad dopo](images/v1.2/ipad-after.png).
- [Form iPad nel motore WebKit](images/v1.2/ipad-webkit.png).
- [Filtri data delle statistiche su iPad/WebKit](images/v1.2/statistics-webkit-ipad.png).
- [Smartphone prima](images/v1.2/mobile-before.png) / [Smartphone dopo](images/v1.2/mobile-after.png).
- [Editor griglia a 320 px](images/v1.2/grid-mobile.png).
- [Anteprima passaggio anno su iPad](images/v1.2/year-preview-ipad.png).

WebKit ha evidenziato una larghezza di 139 px per i campi più annidati a 320 px: le spaziature mobile sono state ridotte. La verifica geometrica misura overflow, larghezze dei campi, target da 44 px e dimensioni dei dialoghi.
La prima CI Linux ha inoltre rilevato i due filtri data delle statistiche a 132,75 px nelle cinque larghezze da 768 a 1180. I contenitori ora hanno una base flessibile di 180 px: la riga può andare a capo senza dipendere dalla larghezza nativa del campo data. I test funzionali erano già verdi; il collaudo CI viene ripetuto dopo la correzione.

## Limiti e rischi residui

- Safari su **iPad/iPhone fisici** e la tastiera nativa devono essere provati dalla docente: WebKit Windows non riproduce integralmente iOS, installazione PWA o VoiceOver.
- Completare/approvare i descrittori matematici prima di usare quei modelli come rubriche ufficiali. I modelli personalizzati sono utilizzabili con i propri descrittori.
- Il backfill dei numeri modifica le versioni delle iscrizioni: prima del futuro deploy far sincronizzare le code offline; eventuali modifiche obsolete devono essere risolte come conflitti, senza sovrascrittura automatica.
- Il passaggio è transazionale e idempotente ma **non ha un pulsante di annullamento distruttivo**. Gli esiti vanno verificati nell'anteprima prima dell'applicazione; eventuali rettifiche richiedono una procedura controllata.
- Se durante la creazione prova viene salvata una nuova regola e poi la RPC fallisce, la regola rimane disponibile; la prova non viene creata parzialmente. Il retry riusa la regola salvata.
- Una correzione analitica parziale può essere salvata come bozza, ma non permette la conferma del voto. I dettagli mancanti non sono stimati.
- L'avviso di dimensione del chunk ExcelJS è preesistente e non blocca la build.
- Vite segnala anche che il piccolo wrapper dei report è condiviso tra import statico e dinamico: le librerie PDF restano caricate su richiesta e la segnalazione non blocca build o stampa.
- Il dry-run elenca i file pendenti e non sostituisce l'esecuzione SQL: la validazione effettiva avviene in PostgreSQL locale e nella CI.

## Sequenza esatta per il futuro rilascio

1. Esaminare la nuova PR `dev → main`, i risultati CI del suo HEAD e questo report. Non unire finché non è autorizzato lo schema cloud.
2. Ottenere autorizzazione esplicita per le sole migrazioni 21–23 sul Ref `mwabfmooefmkszlrymyx`; verificare nuovamente **20/20**, backup disponibile e code offline sincronizzate.
3. Ripetere il dry-run sul Ref esatto. Applicare le tre migrazioni senza `--include-seed`, senza reset, senza `config push` e senza modifiche agli account.
4. Verificare **23/23**, RLS/ACL/RPC, numeri assegnati e conteggi/fingerprint di account, membership e dati storici. Il backfill delle iscrizioni è l'unico aggiornamento di dati previsto dall'installazione.
5. Eseguire prove remote autorizzate con dati fittizi o rollback, login/logout dei workspace e isolamento; non usare password reali nei test automatici.
6. Solo dopo nuova autorizzazione, unire la PR su `main`. Il workflow Pages resta limitato a `main` e all'ambiente `github-pages`; non applica migrazioni cloud.
7. Verificare il rilascio Pages e accettare il prompt di aggiornamento della PWA dopo aver sincronizzato le bozze. Di norma non serve reinstallare; su iOS provare la PWA installata e riaprirla dopo l'aggiornamento.
8. Eseguire un collaudo fisico smartphone/iPad, poi compilare i descrittori e preparare il primo passaggio anno reale con revisione dei singoli esiti.

Il codice rileva le capacità dello schema: finché il cloud resta a 20, i nuovi moduli mostrano la dipendenza dalle migrazioni e il flusso precedente rimane disponibile. Il rilascio V1.2 non è autorizzato da questa preparazione.
