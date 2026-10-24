import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../services/supabase";
import { useAuth } from "../state/auth";
import { useData } from "../state/data";
import { consent, seal, unseal } from "../offline/vault";
import { friendlyError } from "../domain/friendlyErrors";
import type { TimetableData } from "../domain/timetable";
import type { Row, Patch } from "../types/model";
const client = supabase as SupabaseClient;
export function useTimetable() {
  const auth = useAuth(),
    { online } = useData(),
    qc = useQueryClient();
  const key = ["timetable", auth.session?.user.id, auth.workspace];
  const cache = key.join("|");
  const [cacheError, setCacheError] = useState<unknown>();
  const query = useQuery({
    queryKey: key,
    enabled: !!auth.session && !!auth.workspace,
    networkMode: "always",
    retry: false,
    staleTime: 30_000,
    queryFn: async () => {
      if (!navigator.onLine)
        return {
          data: (await unseal<TimetableData>(auth.session!.user.id, cache)) ?? {
            versions: [],
            slots: [],
            exceptions: [],
          },
          available: true,
          cached: true,
        };
      const results = await Promise.all(
        ["versions", "slots", "exceptions"].map(async (n) => {
          const rows: Row[] = [];
          for (let offset = 0; ; offset += 1000) {
            const page = await client
              .from("timetable_" + n)
              .select("*")
              .eq("workspace_id", auth.workspace)
              .is("deleted_at", null)
              .order("created_at")
              .order("id")
              .range(offset, offset + 999);
            if (page.error) return { data: null, error: page.error };
            rows.push(...(page.data as Row[]));
            if (page.data.length < 1000) return { data: rows, error: null };
          }
        }),
      );
      const error = results.find((r) => r.error)?.error;
      if (error) {
        if (["42P01", "PGRST205"].includes(error.code))
          return {
            data: { versions: [], slots: [], exceptions: [] },
            available: false,
            cached: false,
          };
        throw friendlyError(error);
      }
      const data = {
        versions: results[0].data as Row[],
        slots: results[1].data as Row[],
        exceptions: results[2].data as Row[],
      };
      if (consent(auth.session!.user.id))
        await seal(auth.session!.user.id, cache, data);
      return { data, available: true, cached: false };
    },
  });
  const offlineConsent = !!auth.session && consent(auth.session.user.id);
  useEffect(() => {
    if (
      offlineConsent &&
      auth.session &&
      query.data?.available &&
      !query.data.cached
    )
      void seal(auth.session.user.id, cache, query.data.data)
        .then(() => setCacheError(undefined))
        .catch(() =>
          setCacheError(
            Error(
              "Copia offline dell’orario non aggiornata: verifica lo spazio disponibile e riprova online.",
            ),
          ),
        );
  }, [offlineConsent, query.data, cache, auth.session?.user.id]);
  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: key }),
      qc.invalidateQueries({ queryKey: ["data"] }),
    ]);
  }
  async function rpc<T>(
    name: string,
    args: Record<string, unknown>,
  ): Promise<T> {
    if (!online || !navigator.onLine)
      throw Error(
        "Operazione orario disponibile soltanto online. Nessuna modifica accodata.",
      );
    const r = await client.rpc(name, args);
    if (r.error) throw friendlyError(r.error);
    await refresh();
    return r.data as T;
  }
  async function save(
    table: "versions" | "slots" | "exceptions",
    patch: Patch,
    row?: Row,
  ) {
    if (!online || !navigator.onLine)
      throw Error(
        "Le modifiche orario richiedono connessione. La copia offline è in sola lettura.",
      );
    const q = client.from("timetable_" + table);
    const r = row
      ? await q
          .update({ ...patch, version: Number(row.version) + 1 })
          .eq("id", row.id)
          .eq("workspace_id", auth.workspace)
          .eq("version", row.version)
          .select()
          .maybeSingle()
      : await q
          .insert({
            ...patch,
            workspace_id: auth.workspace,
            created_by: auth.session!.user.id,
          })
          .select()
          .single();
    if (r.error) throw friendlyError(r.error);
    if (!r.data)
      throw Error(
        "Orario modificato da un altro dispositivo: ricarica prima di salvare.",
      );
    await refresh();
    return r.data as Row;
  }
  return {
    ...query,
    error: query.error ?? cacheError,
    timetable: query.data?.data ?? { versions: [], slots: [], exceptions: [] },
    available: query.data?.available ?? false,
    cached: query.data?.cached ?? false,
    online,
    save,
    rpc,
  };
}
