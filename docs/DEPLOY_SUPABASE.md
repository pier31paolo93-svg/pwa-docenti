# Deploy controllato Supabase — 22 ottobre 2026

## Risultato
**Deploy completato sul solo progetto pwa-docenti. 17 migrazioni applicate, nessuna anomalia rilevata.**
Ultima verifica: 22 ottobre 2026, 10:20:53 Europe/Rome (UTC+02:00).
Evidenza strutturata senza credenziali: [DEPLOY_RESULT.json](DEPLOY_RESULT.json).

L'utente ha autorizzato esplicitamente la disabilitazione del signup pubblico, le 17 migrazioni validate e le verifiche remote non distruttive. È stato rispettato il vincolo di non creare account, studenti o fixture.

## Destinatario e piano verificati
| Campo | Valore |
|---|---|
| Nome | pwa-docenti |
| Project Ref | mwabfmooefmkszlrymyx |
| Regione | eu-west-1, Ireland |
| Stato prima del deploy | ACTIVE_HEALTHY |
| PostgreSQL remoto | 17.11 |
| Supabase CLI | 2.121.0 |
| Codice delle migrazioni | commit locale e233cc0, manifest SHA-256 verificato |
| Migrazioni applicate | 17/17 |
| Migrazioni pendenti | 0 |

Prima di scrivere sono stati riconfermati Project Ref locale, identità da API, hash di tutti i file del manifest e piano esatto. Il remoto era ancora privo di dati e schema applicativo. L'ulteriore dry-run ha restituito le stesse 17 migrazioni, senza seed o ruoli.

## Supabase Auth
Applicata la sola modifica **auth.enable_signup: true → false**, usando la configurazione isolata deploy/auth-invites-only/supabase/config.toml con Ref esplicito.

La CLI ha confermato una sola proprietà aggiornata e ha lasciato invariate le altre impostazioni. Il confronto finale readonly verifica signup pubblico disabilitato e provider email ancora abilitato. Non sono stati cambiati site URL, redirect, impostazioni di altri servizi o progetti.

Il login rimane disponibile a livello di configurazione; per il futuro provisioning si useranno gli strumenti amministrativi/inviti autorizzati. **Nessun account docente o account di prova è stato creato.** Non è stato simulato un login end-to-end con credenziali personali.

## Applicazione delle migrazioni
Comando eseguito dopo la verifica Auth:
```powershell
npx.cmd --no-install supabase db push --linked --skip-vault --yes
```
Il flag --yes attua l'approvazione esplicita dell'utente sul piano ricontrollato. Nessun --include-seed, --include-roles, reset, riparazione di cronologia, DROP o altro intervento distruttivo.

Tutte le 17 versioni del manifest risultano presenti e allineate tra locale e remoto:
- 20261021000100 fino a 20261021001600: le 16 migrazioni originali.
- 20261022000100: revoca EXECUTE superfluo sul trigger privato.

Elenco completo e hash in [DEPLOY_MANIFEST.json](DEPLOY_MANIFEST.json). Nessun errore durante l'applicazione. Il dry-run finale con --skip-vault ha restituito upToDate=true e migrations=[], seeds=[], roles=[].

## Verifiche remote non distruttive
Eseguita scripts/verify-remote-deployment.sql: **35/35 controlli superati**, esclusivamente SELECT, letture dei cataloghi, conteggi e funzioni pure. Nessuna fixture, ruolo/utente di prova, inserimento temporaneo o cancellazione.

| Oggetto | Risultato verificato |
|---|---|
| Tabelle pubbliche applicative | 44, tutte con RLS |
| Tabelle tecniche private | 2 |
| Viste applicative | 10, tutte security_invoker |
| Funzioni applicative | 23 |
| Indici | 258, tutti validi e ready |
| Vincoli | 401, tutti validati |
| Trigger applicativi public/private | 65 |
| Trigger di provisioning Auth | presente su auth.users |
| Policy RLS pubbliche | 176, quattro distinte per ogni tabella |
| Policy tecniche private | conservate e incluse nel confronto strutturale |
| Utenti Auth | 0 |
| Righe nelle 44 tabelle pubbliche | 0 in ogni tabella |

I 35 controlli includono:
- cronologia esatta delle 17 migrazioni, oggetti attesi e versione PostgreSQL;
- RLS, policy separate, viste invoker e privilegi anonimi negati;
- divieto di hard DELETE per authenticated;
- permessi EXECUTE minimi delle funzioni applicative, assenza di grant a PUBLIC/anon, trigger non eseguibili direttamente;
- search_path sicuro dei SECURITY DEFINER e proprietari fidati;
- scrittura diretta negata su membership/audit e modifica owner non consentita;
- trigger automatici di timestamp/versione, audit voti e provisioning workspace;
- vincoli e indici validi, struttura tecnica delle autorizzazioni completa;
- assenza di utenti, voti, studenti o dati personali, AI disabilitata;
- conversioni numeriche lineari e non lineari, registro e media vuoti.

Le righe tecniche private.access_links e la cronologia delle migrazioni sono metadati creati dalle migrazioni, non seed scolastici o dati personali.

## Confronto con il locale validato
scripts/schema-fingerprint.sql legge solo definizioni e hash.
**1.505 definizioni locali confrontate con 1.505 remote: zero differenze.**

Il confronto copre tabelle, colonne, indici, vincoli, viste, funzioni, trigger e policy. Esclude soltanto l'event trigger predefinito Supabase rls_auto_enable/ensure_rls, già presente prima del deploy e non oggetto delle nostre migrazioni.

Le precedenti prove locali del pacchetto comprendevano due ricostruzioni, ciascuna con 69 pgTAP, 69 SQL diretti e lint senza warning, più due scenari totali di concorrenza. Questi test con fixture **non sono stati eseguiti sul cloud**: il collaudo remoto è stato deliberatamente non distruttivo.

## Limiti e anomalie
Anomalie rilevate: **nessuna**. Nessun conflitto, migrazione mancante, indice invalido, differenza strutturale o dato personale inserito.

Le verifiche non equivalgono a test di carico, audit esterno o collaudo browser/IndexedDB. L'accesso reale via login/invito sarà verificato quando verrà autorizzata la creazione del primo docente. Site URL e redirect verranno configurati per l'hosting effettivo nella fase frontend; non è stata avviata tale fase.

## Git e pubblicazione del risultato
Modifiche di script, report ed evidenze salvate sul branch locale dev con un nuovo commit. Verificato che origin/dev è antenato del branch locale: il push previsto è un avanzamento lineare.

Comando preparato:
```powershell
git push origin dev
```
Il push non è stato eseguito in questo intervento. Nessun merge su main.
