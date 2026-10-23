import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRows, useData } from "../state/data";
import { useAuth } from "../state/auth";
import { useCapabilities } from "../hooks/capabilities";
import { changedFields } from "../domain/teaching";
import { text, type Row } from "../types/model";
import { v12Rpc } from "../services/v12";
import { PageTitle, ErrorBox } from "../components/ui";
export function OperationsHistory() {
  const { data, online } = useData(),
    auth = useAuth(),
    caps = useCapabilities(),
    qc = useQueryClient();
  const records = useRows("record_audit_log", !!caps.data?.recovery),
    grades = useRows("grade_audit_log"),
    years = useRows("year_transitions", !!caps.data?.yearTransition);
  const [kind, setKind] = useState(""),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [from, setFrom] = useState(""),
    [limit, setLimit] = useState(50),
    [to, setTo] = useState("");
  const rows: (Row & { source: string; kind: string })[] = [
    ...(records.data ?? []).map((r) => ({
      ...r,
      source: "record",
      kind: text(r, "table_name"),
    })),
    ...(grades.data ?? []).map((r) => ({
      ...r,
      source: "grade",
      kind:
        (r.new_record as Row)?.status === "confirmed"
          ? (r.old_record as Row)?.status === "confirmed"
            ? "Rettifica voto"
            : "Pubblicazione voto"
          : "Bozza voto",
    })),
    ...(years.data ?? []).map((r) => ({
      ...r,
      source: "year",
      kind: "Passaggio anno",
      actor_id: r.created_by,
    })),
  ]
    .filter(
      (r) =>
        (!kind || r.kind === kind) &&
        (!from || text(r, "created_at").slice(0, 10) >= from) &&
        (!to || text(r, "created_at").slice(0, 10) <= to),
    )
    .sort((a, b) => text(b, "created_at").localeCompare(text(a, "created_at")));
  async function undo(r: Row) {
    if (
      !window.confirm(
        "Annullare questa modifica ripristinando i valori precedenti? Il server ricontrollerà versione, permessi e vincoli dello storico.",
      )
    )
      return;
    setBusy(true);
    setError(undefined);
    try {
      await v12Rpc("undo_record_change", {
        p_audit: r.id,
        p_version: (r.new_record as Row).version,
        p_operation: crypto.randomUUID(),
      });
      await qc.invalidateQueries({ queryKey: ["data"] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="Storico operazioni"
        subtitle="Modifiche autorizzate, rettifiche e passaggi anno. Nessuna promessa di annullamento per conseguenze non reversibili."
      />
      <ErrorBox error={error ?? records.error ?? grades.error ?? years.error} />
      <div className="form-grid">
        <label>
          Tipo operazione
          <select
            aria-label="Tipo operazione"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">Tutte</option>
            {[
              "students",
              "enrollments",
              "Pubblicazione voto",
              "Rettifica voto",
              "Bozza voto",
              "Passaggio anno",
            ].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Dal
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Al
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      {!caps.data?.recovery && (
        <p>
          Lo storico anagrafiche richiede la migrazione 24; lo storico voti
          preesistente resta disponibile.
        </p>
      )}
      {rows.slice(0, limit).map((r) => {
        const next = (r.new_record ?? {}) as Row,
          old = r.old_record as Row | undefined;
        const current =
          r.kind === "students"
            ? data.students?.find((s) => s.id === r.record_id)
            : r.kind === "enrollments"
              ? data.enrollments?.find((e) => e.id === r.record_id)
              : undefined;
        return (
          <article className="card operation-history" key={r.source + r.id}>
            <h2>{r.kind}</h2>
            <p>
              {new Date(text(r, "created_at")).toLocaleString("it-IT")} ·
              Autore:{" "}
              {r.actor_id === auth.session?.user.id
                ? "Tu"
                : text(r, "actor_id").slice(0, 8) || "Operazione di sistema"}
            </p>
            {r.source === "year" ? (
              <p>
                Operazione {r.id} · {JSON.stringify(r.result)}
              </p>
            ) : (
              <dl>
                {changedFields(old, next).map((k) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>
                      {JSON.stringify(old?.[k] ?? null)} →{" "}
                      {JSON.stringify(next[k])}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {r.source === "record" && old && (
              <button
                className="button"
                disabled={!online || busy || current?.version !== next.version}
                onClick={() => void undo(r)}
              >
                Annulla modifica con verifica
              </button>
            )}
            {r.source === "year" && (
              <p>
                Passaggio non annullabile automaticamente: servono rettifiche
                controllate.
              </p>
            )}
          </article>
        );
      })}
      {rows.length > limit && (
        <button className="button" onClick={() => setLimit((n) => n + 50)}>
          Mostra altre operazioni ({rows.length - limit})
        </button>
      )}
    </>
  );
}
