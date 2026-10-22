import { useState } from "react";
import { Download } from "lucide-react";
import { exportRows, type ExportRow } from "../services/export";
import { useData } from "../state/data";
export function ExportMenu({
  title,
  rows,
}: {
  title: string;
  rows: ExportRow[];
}) {
  const [busy, setBusy] = useState(false);
  const { notice } = useData();
  return (
    <div className="export-menu">
      <Download size={16} />
      <select
        aria-label="Esporta dati"
        value=""
        disabled={busy || !rows.length}
        onChange={async (e) => {
          const format = e.target.value as "csv" | "xlsx" | "pdf";
          if (!format) return;
          if (
            !window.confirm(
              "Il file conterrà dati personali autorizzati. Conservalo su un dispositivo sicuro. Continuare?",
            )
          )
            return;
          setBusy(true);
          try {
            await exportRows(format, title, rows);
            notice("Esportazione completata.");
          } catch (e) {
            notice(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <option value="">{busy ? "Esportazione…" : "Esporta"}</option>
        <option value="csv">CSV</option>
        <option value="xlsx">Excel</option>
        <option value="pdf">PDF</option>
      </select>
    </div>
  );
}
