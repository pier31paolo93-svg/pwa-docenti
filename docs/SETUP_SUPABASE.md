# Setup Supabase
## Rilevazione iniziale
Cartella iniziale vuota, nessun repository Git né remote. Node 25.7.0, npm 11.10.1; PostgreSQL 16.14 e 18 presenti fuori dal PATH. Docker non disponibile. Installata CLI Supabase 2.121.0 come devDependency con package-lock.json. Nessuna autenticazione cloud effettuata e nessun progetto collegato.

## Verifica completa con Docker
Installare/avviare Docker Desktop con motore Linux tramite procedura ufficiale, poi:
```powershell
npm ci
npx --no-install supabase start
npx --no-install supabase db reset --local
npx --no-install supabase test db
npx --no-install supabase db lint --local --level warning --fail-on warning
```
Ripetere reset --local, test e lint su ambiente pulito. La directory scripts/native-bootstrap.sql è soltanto uno shim Auth di test: non copiarla nelle migrazioni e non applicarla al cloud.

## Collegamento cloud — da eseguire successivamente
Il progetto autorizzato esiste già: pwa-docenti, West EU (Ireland), piano Free. Non crearne altri. Usare login ufficiale interattivo, non comunicare token/password in chat:
```powershell
npx --no-install supabase login
npx --no-install supabase projects list
npx --no-install supabase link --project-ref <REF_VERIFICATO>
```
L'utente completa il login e gli eventuali prompt segreti. Verificare nel dashboard che REF corrisponda proprio a pwa-docenti, organizzazione corretta, regione Ireland e PostgreSQL compatibile. Non basta il nome descrittivo.

Prima di una prima migrazione controllare lo schema esistente in lettura; se contiene oggetti omonimi preparare una baseline e una riconciliazione, non forzare queste migrazioni.

Disabilitare la registrazione pubblica nelle impostazioni Auth cloud e usare inviti amministrativi. enable_signup=false nel config locale **non prova** che il cloud sia configurato così. Verificare anche i redirect URL della futura PWA GitHub Pages.

## Prima dell'applicazione remota
1. Completare test pgTAP, lint e ripetibilità locali.
2. Leggere stato e identità del progetto e cronologia migrazioni.
3. Mostrare riepilogo e risultato:
```powershell
npx --no-install supabase migration list --linked
npx --no-install supabase db push --linked --dry-run --skip-vault
```
4. Chiedere autorizzazione esplicita dell'utente sull'identità e sulle migrazioni concrete.
5. Solo dopo approvazione:
```powershell
npx --no-install supabase db push --linked --skip-vault
```
Mai usare --include-seed, db reset --linked, DROP remoto o creare/eliminare progetti. Nessun reset cloud è necessario.

Il seed.sql è esclusivamente fittizio e locale. Il cloud parte senza studenti, scuole o utenti demo. I workspace vengono creati dal trigger dopo l'invito dei veri utenti. Le categorie/regole iniziali potranno essere inserite dagli Owner con dati approvati; non c'è seed di produzione implicito.

## GitHub
Repository indicato dall'utente: https://github.com/pier31paolo93-svg/pwa-docenti.git. Verificato main al commit ed22cc3 con solo README iniziale; collegato origin e basato dev su quella storia preservando i file locali. Nessun push eseguito. La CI proposta esegue soltanto controlli locali Docker, non deploy cloud.
## Fonti
- https://supabase.com/docs/guides/local-development
- https://supabase.com/docs/guides/local-development/cli/testing-and-linting
- Help effettivo della CLI installata: supabase db push --help e supabase db lint --help.
