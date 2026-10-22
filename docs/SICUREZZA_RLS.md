# Sicurezza RLS
## Matrice ruoli
| Operazione | Owner | Admin | Teacher | Viewer | Anonimo |
|---|---|---|---|---|---|
| Leggere dati condivisi del workspace | sì | sì | sì, dati didattici delle assegnazioni proprie | sì | no |
| Leggere record privati altrui, anche indirettamente | no | no | no | no | no |
| Inserire anagrafiche | sì | sì | sì, come autore | no | no |
| Modificare dati condivisi altrui | sì | sì | no | no | no |
| Scrivere dati didattici | sì | sì | solo propri e nelle assegnazioni proprie | no | no |
| Gestire assegnazioni didattiche | sì | sì | no | no | no |
| Gestire categorie/regole/config AI | sì | sì | no | no | no |
| Cambiare ruoli con RPC | sì, escluso Owner | no | no | no | no |
| Hard delete | no | no | no | no | no |

Un Teacher vede le anagrafiche condivise, ma il controllo ricorsivo nega i dati dipendenti da assegnazioni di altri docenti. Un Viewer è un ruolo esplicitamente destinato alla consultazione condivisa. Il privato è sempre riservato all'autore, anche per Owner/Admin. profiles è leggibile soltanto dall'interessato; gli UUID degli autori restano disponibili sui dati scolastici.

## Meccanismi
Ogni tabella pubblica ha RLS e quattro policy distinte SELECT/INSERT/UPDATE/DELETE. I GRANT sono verificati separatamente: anon non ha privilegi sulle tabelle/viste/RPC; authenticated non ha DELETE né scrittura audit. I membri non sono modificabili con DML client. I GRANT di profilo/workspace limitano le colonne aggiornabili.

private.allowed controlla appartenenza, visibilità, ruolo e riferimenti. I riferimenti parentali sono verificati ricorsivamente dal catalogo privato access_links. private.assignment_access estende il controllo di assegnazione ai risultati indiretti. Profondità massima 20: catene eccessive sono negate. Queste funzioni SECURITY DEFINER restituiscono autorizzazioni, non dati; search_path è vuoto e gli oggetti sono qualificati. I nomi per SQL dinamico provengono da catalogo privato o whitelist e sono quotati con format(%I).

Altre funzioni SECURITY DEFINER: bootstrap auth, append audit, gestione membri. Sono operazioni minime; nessuna funzione consente SQL arbitrario. Trigger helper privati non sono RPC. Lo schema private non è esposto in api.schemas. RPC dati/sync/import sono SECURITY INVOKER e rispettano RLS.

I trigger impediscono spoofing autore, modifica workspace/UUID/timestamp origine, cambio visibilità, riscrittura riferimenti dei risultati e aggiornamenti senza incremento versione esatto. Le FK composite proteggono anche in bypass RLS amministrativo. Note private nei genitori rendono inaccessibili i risultati figli.

## Viste e audit
Tutte le 10 viste hanno security_invoker=true e GRANT SELECT solo authenticated. Le RPC di media sono invoker. L'audit è inserito esclusivamente da trigger e leggibile solo se il voto corrente è leggibile. Lo storico include vecchia/nuova riga, attore, orario e operazione; il client non può modificarlo.

## Limiti operativi
Il ruolo PostgreSQL postgres e la service_role sono amministrativi e possono bypassare RLS: non inserirli mai nella PWA. Per le Edge Function future occorre verificare JWT e autorizzazioni prima di usare privilegi amministrativi.

RLS non cifra il dispositivo offline e non revoca dati già scaricati quando il dispositivo è disconnesso. Il contratto offline prescrive scadenza sessione, cancellazione cache al logout/revoca e nuova scansione autorizzata.

Completato il collaudo database sullo stack Supabase reale PostgreSQL 17.11: pgTAP, SQL diretto, concorrenza e lint public/private senza warning, su due ricostruzioni pulite. I test usano ruoli e auth.uid() reali di Supabase. L'autenticazione end-to-end via HTTP/PostgREST e un audit esterno di sicurezza restano fuori dal perimetro di questo collaudo database; vedere TEST_REPORT.md.
