import { useState } from "react";
import { useAuth } from "../state/auth";
import { useData } from "../state/data";
import { useCapabilities } from "../hooks/capabilities";
import { catalog } from "../domain/catalog";
import { pull } from "../services/api";
import { supabase } from "../services/supabase";
import type { SourceName, Row } from "../types/model";
import { PageTitle, ErrorBox } from "../components/ui";
export function WorkspaceExport() {
  const auth = useAuth(),
    { online } = useData(),
    caps = useCapabilities(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [report, setReport] = useState("");
  async function download() {
    if (!online) return;
    if (
      !window.confirm(
        "Esportare tutti i record del workspace leggibili con i tuoi permessi? Il file conterrà dati riservati e non è un backup infrastrutturale ripristinabile.",
      )
    )
      return;
    setBusy(true);
    setError(undefined);
    try {
      const tables = [
        ...Object.keys(catalog).filter(
          (t) => t !== "recovery_activities" || caps.data?.recovery,
        ),
        "grade_audit_log",
        "import_batches",
        "import_rows",
        "ai_workspace_settings",
        "ai_requests",
        ...(caps.data?.recovery
          ? ["recovery_students", "record_audit_log"]
          : []),
        ...(caps.data?.yearTransition ? ["year_transitions"] : []),
      ];
      const result: Record<string, Row[]> = {};
      for (const t of tables) {
        const rows = await pull(t as SourceName, auth.workspace);
        result[t] = rows.map(
          (r) =>
            Object.fromEntries(
              Object.entries(r).filter(
                ([k]) =>
                  !/(password|secret|token|service_role|api_key)/i.test(k),
              ),
            ) as Row,
        );
      }
      const workspace = await supabase
        .from("workspaces")
        .select("*")
        .eq("id", auth.workspace);
      const members = await supabase
        .from("workspace_members")
        .select("workspace_id,user_id,role,created_at")
        .eq("workspace_id", auth.workspace);
      if (workspace.error) throw workspace.error;
      if (members.error) throw members.error;
      result.workspaces = workspace.data as Row[];
      const blob = new Blob(
        [
          JSON.stringify(
            {
              format: "quaderno-user-export-v1",
              exported_at: new Date().toISOString(),
              workspace: auth.workspace,
              scope: "Record visibili tramite RLS, non backup del database",
              membership: members.data,
              tables: result,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download =
        "quaderno-workspace-" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setReport(
        `${tables.length} tabelle autorizzate, ${Object.values(result).reduce((n, r) => n + r.length, 0)} record esportati.`,
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="Esportazione workspace"
        subtitle="Esportazione utente dei dati autorizzati, distinta dal backup infrastrutturale Supabase."
      />
      <ErrorBox error={error} />
      <section className="card">
        <p>
          Il file JSON conserva riferimenti e storico visibili al tuo ruolo. Non
          include utenti Auth, password, chiavi o tabelle tecniche private. Non
          permette un ripristino automatico del database. Le esportazioni PDF,
          CSV e XLSX filtrate rimangono nei moduli classe, studente, registro,
          verifiche e recupero.
        </p>
        <button
          className="button primary"
          disabled={!online || busy}
          onClick={() => void download()}
        >
          {busy ? "Esportazione…" : "Esporta dati autorizzati del workspace"}
        </button>
        <p role="status">{report}</p>
      </section>
    </>
  );
}
