import { supabase } from "./supabase";
import { friendlyError } from "../domain/friendlyErrors";
import type { Json } from "../types/database";
export async function v12Rpc<T>(
  name:
    | "preview_year_transition"
    | "apply_year_transition"
    | "create_grid_assessment"
    | "preview_student_import"
    | "apply_student_import"
    | "undo_record_change",
  args: Record<string, unknown>,
): Promise<T> {
  if (!navigator.onLine)
    throw Error(
      "Questa operazione richiede una connessione online e non viene inviata alla coda offline.",
    );
  const client = supabase as unknown as {
    rpc: (
      name: string,
      args: Record<string, Json | undefined>,
    ) => Promise<{
      data: unknown;
      error: { code?: string; message?: string } | null;
    }>;
  };
  const { data, error } = await client.rpc(
    name,
    args as Record<string, Json | undefined>,
  );
  if (error) {
    if (error.code === "PGRST202")
      throw Error(
        "Funzione non ancora disponibile: è necessaria la relativa migrazione cloud autorizzata.",
      );
    throw friendlyError(error);
  }
  return data as T;
}
