import { italianDate } from "../domain/time";
import { gridSummary, type Grid } from "../domain/grids";
import type { Row } from "../types/model";
export type GridReportStudent = {
  name: string;
  result?: Row;
  questions: Row[];
  grade?: Row;
};
let font: Promise<string> | undefined;
function pdfFont() {
  return (font ??= fetch(import.meta.env.BASE_URL + "fonts/DejaVuSans.ttf")
    .then(async (r) => {
      if (!r.ok)
        throw Error(
          "Font PDF non disponibile. Ricarica online prima di esportare.",
        );
      const bytes = new Uint8Array(await r.arrayBuffer());
      let s = "";
      for (let i = 0; i < bytes.length; i += 8192)
        s += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return btoa(s);
    })
    .catch((e) => {
      font = undefined;
      throw e;
    }));
}
export const exportBlankGrid = (
  grid: Grid,
  context?: { title: string; context: string; date: string },
) =>
  gridReport(
    "blank",
    context
      ? {
          ...grid,
          title: `${context.title} · ${context.context} · ${italianDate(context.date)}`,
        }
      : grid,
  );
export async function gridReport(
  kind: "blank" | "student" | "class" | "competencies",
  grid: Grid,
  students: GridReportStudent[] = [],
) {
  const { jsPDF } = await import("jspdf");
  const { default: table } = await import("jspdf-autotable");
  const doc = new jsPDF({ format: "a4" });
  doc.addFileToVFS("DejaVuSans.ttf", await pdfFont());
  doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.addFont("DejaVuSans.ttf", "DejaVu", "bold");
  doc.setFont("DejaVu");
  doc.setFontSize(16);
  doc.text(doc.splitTextToSize(grid.title, 180), 14, 18);
  const title =
    kind === "blank"
      ? "Griglia vuota"
      : kind === "student"
        ? "Correzione individuale"
        : kind === "class"
          ? "Riepilogo classe"
          : "Competenze: evidenze disponibili";
  let y = 22 + doc.splitTextToSize(grid.title, 180).length * 6;
  doc.setFontSize(10);
  doc.text(title, 14, y);
  y += 8;
  const draw = (head: string[], body: string[][]) => {
    table(doc, {
      startY: y,
      head: [head],
      body,
      styles: {
        font: "DejaVu",
        fontSize: 9,
        cellPadding: 2.5,
        overflow: "linebreak",
      },
      headStyles: { fillColor: [22, 78, 66] },
      rowPageBreak: "avoid",
      pageBreak: "avoid",
      margin: { top: 16, bottom: 18 },
      didDrawPage: () => {
        doc.setFont("DejaVu");
        doc.setFontSize(8);
        doc.text(
          `Quaderno Docenti · Dati riservati · ${doc.getNumberOfPages()}`,
          14,
          289,
        );
      },
    });
    y =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 9;
    if (y > 265) {
      doc.addPage();
      y = 18;
    }
  };
  if (kind === "blank" || kind === "student") {
    const student = kind === "student" ? students[0] : undefined;
    if (student) {
      doc.text(doc.splitTextToSize(student.name, 180), 14, y);
      y += 10;
    }
    const summary = gridSummary(
      grid,
      student?.questions ?? [],
      student?.result?.id,
    );
    for (const section of summary.sections) {
      draw(["Sezione", "Massimo"], [[section.label, section.maximum]]);
      for (const exercise of section.exercises) {
        draw(
          ["Esercizio", "Massimo", "Punti"],
          [[exercise.label, exercise.maximum, exercise.obtained ?? ""]],
        );
        const detail = exercise.row?.criterion_scores as
          Record<string, number> | undefined;
        draw(
          ["Criterio / competenza", "Massimo", "Punti / descrittori"],
          exercise.criteria.map((c) => [
            c.label +
              (c.competency_id
                ? " · " +
                  (grid.competencies.find((s) => s.id === c.competency_id)
                    ?.label ?? "")
                : ""),
            c.maximum,
            (detail?.[c.id] == null
              ? exercise.obtained != null
                ? "Dettaglio non rilevato"
                : ""
              : String(detail[c.id])) +
              "\n" +
              c.description +
              "\n" +
              c.levels
                .map(
                  (l) =>
                    `${l.label} [${l.from}, ${l.to}]: ${l.description || "Descrittore da completare"}`,
                )
                .join("\n"),
          ]),
        );
      }
    }
    draw(
      ["Totale", "Massimo", "Voto confermato"],
      [
        [
          student ? summary.obtained : "",
          grid.maximum,
          String(student?.grade?.confirmed_value ?? "Non confermato"),
        ],
      ],
    );
  } else if (kind === "class")
    draw(
      [
        "Studente / numero",
        "Punti",
        "Massimo",
        "Avanzamento",
        "Voto confermato",
      ],
      students.map((s) => {
        const a = gridSummary(grid, s.questions, s.result?.id);
        return [
          s.name,
          a.obtained,
          a.maximum,
          `${a.completed}/${a.expected}`,
          String(s.grade?.confirmed_value ?? "Non confermato"),
        ];
      }),
    );
  else
    draw(
      [
        "Studente",
        "Competenza",
        "Punti analitici",
        "Massimo",
        "Dettaglio mancante",
      ],
      students.flatMap((s) =>
        gridSummary(grid, s.questions, s.result?.id).skills.map((c) => [
          s.name,
          c.label,
          c.obtained,
          c.available,
          c.missing ? `${c.missing} criteri: totale parziale` : "Completo",
        ]),
      ),
    );
  doc.save(`quaderno-griglia-${kind}.pdf`);
}
