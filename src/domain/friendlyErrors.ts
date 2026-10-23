export function friendlyError(error: unknown): Error {
  const e = error as { code?: string; message?: string };
  if (e?.code === "23505")
    return new Error(
      "Dato già presente: controlla codice, iscrizione e numero di registro della classe. Aggiorna l’elenco prima di riprovare.",
    );
  if (e?.code === "23503")
    return new Error(
      "Il riferimento non è disponibile nel workspace oppure è utilizzato nello storico.",
    );
  if (e?.code === "40001" || e?.code === "PT409")
    return new Error(
      "Il record è stato modificato: aggiorna i dati e confronta le revisioni prima di salvare.",
    );
  if (e?.code === "42501")
    return new Error(
      "Non hai i permessi per questa operazione nel workspace corrente.",
    );
  return error instanceof Error
    ? error
    : new Error(
        e?.message || "Operazione non riuscita. Controlla i campi e riprova.",
      );
}
