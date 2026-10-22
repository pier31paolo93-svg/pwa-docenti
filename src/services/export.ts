import { text, type Row } from "../types/model";
export type ExportRow = Record<string, string | number | boolean | null>;
export function safeCell(value: unknown): string {
  const s =
    value == null
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return /^[\t\r\n]|^\s*[=+\-@]/u.test(s) ? "'" + s : s;
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportRows(
  format: "csv" | "xlsx" | "pdf",
  title: string,
  rows: ExportRow[],
) {
  if (!rows.length) throw new Error("Nessun dato autorizzato da esportare.");
  const keys = [...new Set(rows.flatMap(Object.keys))];
  const name = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (format === "csv") {
    const { unparse } = await import("papaparse");
    download(
      new Blob(
        [
          "\uFEFF" +
            unparse(
              rows.map((r) =>
                Object.fromEntries(keys.map((k) => [k, safeCell(r[k])])),
              ),
            ),
        ],
        { type: "text/csv;charset=utf-8" },
      ),
      name + ".csv",
    );
  }
  if (format === "xlsx") {
    const Excel = await import("exceljs");
    const wb = new Excel.Workbook();
    const sheet = wb.addWorksheet("Riepilogo");
    sheet.columns = keys.map((k) => ({
      header: k,
      key: k,
      width: Math.min(45, Math.max(18, k.length + 3)),
    }));
    for (const r of rows)
      sheet.addRow(
        Object.fromEntries(
          keys.map((k) => [
            k,
            typeof r[k] === "number" ? r[k] : safeCell(r[k]),
          ]),
        ),
      );
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF164E42" },
    };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    const b = await wb.xlsx.writeBuffer();
    download(
      new Blob([new Uint8Array(b)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      name + ".xlsx",
    );
  }
  if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({
      orientation: keys.length > 5 ? "landscape" : "portrait",
    });
    doc.setFontSize(20);
    doc.setTextColor("#164e42");
    doc.text(title, 14, 20);
    doc.setFontSize(9);
    doc.setTextColor("#65716b");
    doc.text(
      "Quaderno Docenti · " + new Date().toLocaleDateString("it-IT"),
      14,
      28,
    );
    autoTable(doc, {
      startY: 35,
      head: [keys],
      body: rows.map((r) =>
        keys.map((k) => (r[k] == null ? "" : String(r[k]))),
      ),
      styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
      headStyles: { fillColor: [22, 78, 66] },
      alternateRowStyles: { fillColor: [244, 246, 240] },
      margin: { bottom: 18 },
      didDrawPage: () => {
        doc.setFontSize(8);
        doc.text(
          "Dati riservati · " + doc.getNumberOfPages(),
          14,
          doc.internal.pageSize.height - 8,
        );
      },
    });
    doc.save(name + ".pdf");
  }
}
export function publicColumns(rows: Row[]): ExportRow[] {
  return rows.map((r) =>
    Object.fromEntries(
      Object.entries(r)
        .filter(
          ([k, v]) =>
            !["workspace_id", "created_by", "calculation_snapshot"].includes(
              k,
            ) && typeof v !== "object",
        )
        .map(([k]) => [k, text(r, k)]),
    ),
  );
}
