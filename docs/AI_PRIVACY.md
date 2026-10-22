# AI e privacy
AI disabilitata per impostazione predefinita e non attivabile in fase 1: ai_workspace_settings.enabled ha CHECK(enabled=false). ai_requests registra solo tipo di richiesta, stato disabled e versione del contratto; non contiene nomi, UUID studenti, prompt liberi o note.

La Edge Function ai-suggestions è uno stub: richiede JWT nella configurazione, restituisce HTTP 501 AI_DISABLED e non legge o invia dati a provider. Non è stata distribuita.

## Contratto futuro
Input consentiti: aggregati anonimi per argomento/competenza, frequenze degli errori, livello della classe espresso per fascia e obiettivo didattico. Escludere nomi, cognomi, codici interni, UUID studenti, note personali e testo libero non revisionato. Anche piccoli aggregati possono identificare uno studente: definire soglia minima e controllo server prima di abilitarli.

Un'eventuale fase successiva richiederà provider autorizzato, trattamento dati, opt-in workspace, verifica server delle autorizzazioni, anonimizzazione, controlli sui payload, quote e retention. Le risposte AI saranno suggerimenti; nessun voto verrà confermato automaticamente.

Chiavi provider soltanto nei secret server Supabase, mai nelle tabelle pubbliche, nel browser, nel repository o nelle variabili build GitHub Pages. Nessun provider o secret è configurato qui.
