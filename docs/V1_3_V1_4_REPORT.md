# Quaderno Docenti V1.3 e V1.4

Collaudo del 23 ottobre 2026. Sviluppo sul branch `dev`, a partire da `6b311a4`, con V1.2 già presente. La PR #3 raccoglie V1.2, V1.3 e V1.4: non occorre unire una PR intermedia incompatibile.

## Stato e limiti del rilascio

Nessuna modifica al database cloud, agli account reali, a `main` o a GitHub Pages. Nessun reset Supabase eseguito. Il progetto cloud autorizzato resta `pwa-docenti`, Ref `mwabfmooefmkszlrymyx`; l'ultima verifica cloud documentata nella V1.2 rilevava 20 migrazioni. Questo ciclo non ha rieseguito il collegamento o interrogato il cloud.

Lo stack locale PostgreSQL 17.11 contiene 26 migrazioni. Le 21–23 della V1.2 restano inalterate; le nuove 24–26 sono state applicate e rifinite soltanto in locale. Per la pubblicazione servirà autorizzare e verificare l'intera sequenza mancante sul cloud. I controlli di capacità mantengono i moduli precedenti utilizzabili quando mancano le nuove colonne o RPC.

## Funzionalità

| Area | Comportamento implementato |
| --- | --- |
| Registro rapido | Classe/materia, data e lezione reale; studenti ordinati per registro; compiti fatti/parziali/non fatti/non controllati; azione massiva con eccezioni, preservazione giustificazioni; partecipazione e note come osservazioni canoniche; valutazione esplicita tramite GradeEditor; protezione modifiche non salvate e feedback. |
| Correzione griglie | Un esercizio alla volta, precedente/successivo esercizio e studente, contatori, massimo rapido, autosalvataggio delle sole bozze esplicite valide dopo 900 ms. Alt+frecce cambia esercizio, Alt+Maiusc+frecce studente, Ctrl/Cmd+Invio salva. Mancante non significa zero. Riepilogo e conferma del voto rimangono espliciti; assenti e prove incomplete non vengono pubblicati. |
| Scheda studente | Dieci sezioni: profilo, iscrizioni, voti/medie, verifiche, compiti, partecipazione, osservazioni, competenze, progressi, recupero. Contesto anno/scuola/classe/materia e storico canonico; nessuna duplicazione dei voti. |
| Sincronizzazione | Online/offline, coda account, conflitti/errori, ultima sincronizzazione riuscita per workspace, copia cifrata, retry esplicito e blocco rimozione cache con operazioni pendenti. La testata indica Online, senza promettere una sincronizzazione verificata. Nessun aggiornamento PWA elimina la coda automaticamente. |
| Storico | Audit anagrafiche/iscrizioni, audit voti esistente e passaggi anno. Autore, data e differenze. Annullamento delle sole modifiche compatibili con versione, RLS e vincoli; retry idempotente. Nessun annullamento automatico di inserimenti o passaggi anno. |
| Calendario | Giorno/settimana/mese/elenco; filtri generali e tipologia; lezioni, verifiche, orali, scadenze compiti e recuperi; link e modifica dei record originali. Europe/Rome anche negli editor, date senza orario preservate. Gli orari ambigui/inesistenti al cambio d'ora richiedono un orario non ambiguo. Nessun calendario esterno o modello personale inventato. |
| Importazione avanzata | CSV/XLSX, mapping, classe/numero, modelli scaricabili, riconciliazione per identità/codice con scelta esplicita per omonimi e file senza codice; prima/dopo, anteprima server senza scritture, applicazione atomica Owner/Admin, versioni, conflitti numero e fingerprint SHA-256 contro retry/file ripetuti. Pagine da 50 righe, massimo 1.000 righe e 5 MB. |
| Analisi | Singola verifica: media aritmetica descrittiva, mediana, min/max, distribuzione, sufficienze sui soli confermati; assenti, non corrette, incomplete e bozze separati. Esercizi ordinati per percentuale dei punti disponibili; competenze solo da evidenze analitiche. Statistiche canoniche pesate preesistenti conservate. Filtri per studente/classe/materia/anno/periodo, compiti/partecipazione, argomenti e difficoltà ricorrenti da collegamenti reali. Campioni ridotti segnalati; nessun giudizio o diagnosi automatici. |
| Recupero | Attività per classe/materia, argomento, obiettivo, scadenza e verifica di origine; assegnazioni deliberate, stato/esito per studente; scheda studente, calendario ed export. Supporta le mutazioni canoniche online/offline, con RLS e FK composite. |
| Esportazioni | PDF/CSV/XLSX dei moduli e del recupero, secondo i filtri applicati. Export JSON fresco di tutti i record di dominio autorizzati del workspace, audit, import e membership visibile, con riferimenti; esclusi Auth, password e tabelle private. L'interfaccia distingue esplicitamente l'export utente da un backup infrastrutturale ripristinabile. |
| Navigazione | Azioni rapide in home senza nuove query pesanti; aree registro/calendario/valutazioni/organizzazione, cinque destinazioni mobile; storico, sincronizzazione ed export dalle impostazioni. Moduli nuovi caricati tramite import dinamico. |

## Migrazioni incrementali

1. **24 — `20261023000400_daily_recovery_audit.sql`**: `homework_checks.daily_status`, `assessment_results.attendance`, aggiornamento `v_homework_completion` mantenendo security_invoker e ACL; `recovery_activities`, `recovery_students`, FK composite, indici, trigger, RLS e whitelist della RPC canonica. `record_audit_log` append-only per studenti/iscrizioni e `undo_record_change` SECURITY INVOKER con versione e idempotenza. Nessuna modifica alle anagrafiche esistenti.
2. **25 — `20261023000500_daily_links_advanced_import.sql`**: collegamento opzionale osservazione/lezione con coerenza data Europe/Rome e unicità per studente/lezione; fingerprint e report su batch import esistenti; `preview_student_import` e `apply_student_import`, SECURITY INVOKER, Owner/Admin e RLS. Nessuna interrogazione diretta di `auth.users`; nessun seed.
3. **26 — `20261023000600_attendance_guards.sql`**: impedisce conferma di un voto per un assente e cambio ad assente con un voto ancora confermato. Una successiva correzione dettagliata dei compiti azzera soltanto il riepilogo giornaliero opzionale e riattiva il calcolo canonico dai dettagli, con incremento di versione. Evita che il registro rapido nasconda le correzioni del modulo Compiti preesistente.

Le nuove funzioni trigger hanno `search_path=''` ed EXECUTE revocato ai ruoli client. Le RPC pubbliche negano PUBLIC/anon e ricontrollano ruoli, proprietà, workspace e versioni. Nuovi oggetti senza hard delete client. Non sono state riscritte le migrazioni 1–23.

## Verifiche e accettazione

Risultati consolidati e hash delle migrazioni in [V1_3_V1_4_VALIDATION.json](V1_3_V1_4_VALIDATION.json). Gli eventuali errori intermedi sono stati corretti e le verifiche pertinenti ripetute; non costituiscono risultati positivi.

**Locale: 76/76 unit test, 192/192 pgTAP, 69/69 SQL, due writer concorrenti verificati, 33/33 E2E.** Typecheck, lint PostgreSQL, build di produzione, cinque controlli negativi/positivi della configurazione, verifica artefatto Pages e prova service worker/offline/aggiornamento PWA superati. Audit di **824 schermate Chromium + 824 WebKit**, a 320/375/390/768/820/834/1024/1180 px: zero overflow, campi troppo stretti, target inferiori a 44 px o dialog tagliati. [Schermate dei nuovi flussi, con soli dati fittizi](images/v1.3-v1.4).

La scansione dei sorgenti e dei file da pubblicare non ha rilevato credenziali privilegiate; `.env.local`, `.env.test.local` e credenziali delle fixture sono ignorati. La stringa `sb_secret_rejected_test_value` è soltanto una fixture negativa preesistente per verificare il rifiuto delle chiavi segrete, non una chiave utilizzabile. Il bundle di produzione accetta soltanto URL e publishable key autorizzati.

| Criterio richiesto | Evidenza automatizzata |
| --- | --- |
| 1. Compiti della classe senza cambiare pagina | `v134.spec.ts`: azione massiva, eccezione non controllato, note e persistenza canonica. |
| 2–3. Mancante distinto da zero e ripresa bozza | SQL V134 e scenario autosave: nessun risultato iniziale, zero esplicito, massimo, reload. |
| 4. Unico voto pubblicato | Vincoli e pgTAP esistenti, conferma esplicita E2E, analisi limitata ai confermati. |
| 5. Coerenza scheda studente | E2E voto nel registro della nuova sezione e recupero nella scheda; moduli leggono gli stessi record. |
| 6. Offline senza perdita | E2E coda offline, ritorno online, conflitto con revisione remota e scelta esplicita; copia cifrata. |
| 7. Calendario canonico | E2E creazione di una vera verifica, quattro viste, aggiornamento dell'originale riflesso nel calendario. |
| 8–9. Import ripetuto e numeri duplicati | E2E e pgTAP: anteprima conflitto, import atomico, retry con nuovo UUID, una sola persona. |
| 10. Statistiche senza incomplete definitive | Unit test confermati/null/bozze/annullati, stati distinta assenza; pgTAP blocco pubblicazione assenti. |
| 11. Recupero nella scheda | E2E creazione attività, assegnazione, esito, scheda e calendario. |
| 12. iPad verticale/orizzontale | E2E calendario 834×1194 e 1180×820; audit Chromium/WebKit di schermate ed editor. |
| 13. Workspace separati | pgTAP cross-workspace, Teacher/Viewer, RPC import e audit; E2E autenticazione, directory docenti ed export senza workspace altrui. |
| 14. Storico preservato | Suite V1.2 passaggio anno/iscrizioni e FK storiche; nuovi audit e annullamento senza riscrivere annualità. |
| 15. Regressione | Suite frontend preesistente, 69 SQL, pgTAP completo, PWA, lint, typecheck, build e CI. |

I test usano esclusivamente utenti, studenti e workspace fittizi locali. La CI avvia Supabase in un runner effimero, applica le migrazioni all'avvio e ripete pgTAP/lint senza reset. Il workflow Pages e il vincolo al solo `main` non cambiano.

## Rischi e collaudo manuale

- **Migrazioni cloud ancora da autorizzare**: non pubblicare il frontend completo prima del collaudo di 21–26 sul progetto corretto. La V1.2 è compresa nella stessa PR.
- **iPad/iPhone fisici**: verificare tastiera e dettatura, Safe Area, orientamento, Safari/PWA installata, ripresa dopo sospensione, VoiceOver, condivisione PDF/XLSX e cambio rete. WebKit desktop non certifica il comportamento del sistema iPadOS.
- **Autosalvataggio**: riguarda bozze di esercizi valide. Un campo vuoto non cancella un risultato salvato; usare una rettifica esplicita. La pubblicazione richiede sempre il docente. Le operazioni aggregate import/passaggio anno/export richiedono rete.
- **Offline**: abilitare la copia cifrata e aprire i moduli necessari prima di perdere la rete; il recupero viene memorizzato quando consultato. Risolvere conflitti senza svuotare lo storage; aggiornamento PWA conserva le operazioni pendenti.
- **Import**: lo stesso contenuto con la stessa mappatura e destinazione viene riconosciuto come già applicato, anche se cambiano le scelte successive. Per una nuova importazione intenzionale occorre un contenuto diverso, con nuova anteprima; nessun aggiornamento silenzioso. Gli scambi simultanei di numeri già occupati sono respinti e richiedono una riconciliazione controllata.
- **Analisi**: la media della singola verifica è aritmetica descrittiva sui confermati, distinta dalle medie pesate canoniche con esclusioni/categorie. La soglia 6 è indicata come descrittiva quando una regola storica non la specifica. Punteggi di competenza mancanti non sono ricavati dal voto globale.
- **Export**: contiene dati riservati autorizzati e richiede custodia da parte della docente. Non include credenziali e non offre un ripristino automatico.
- **Peso bundle**: ExcelJS rimane un chunk dinamico di circa 930 kB, caricato solo per XLSX. Avviso già noto, non query o grafico aggiunto in home.

## Sequenza di rilascio

1. Revisionare PR #3 e risultati CI; collaudare su dispositivo fisico.
2. Con autorizzazione separata: verificare Ref e cronologia cloud, backup infrastrutturale, dry-run delle sole migrazioni mancanti 21–26, senza seed/reset.
3. Solo dopo autorizzazione del deploy SQL: applicare in ordine, verificare 26/26, RLS/ACL, integrità, account/workspace invariati; test remoti con dati fittizi e rollback.
4. Verificare login/logout, isolamento dei due workspace e salvataggi reali autorizzati. Controllare le variabili frontend pubbliche del solo progetto previsto.
5. Solo con autorizzazione al rilascio: merge su `main` e workflow Pages esistente. Conservare la coda offline e verificare aggiornamento della PWA prima di reinstallazioni o pulizie.
