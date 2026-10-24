import { useData } from "../state/data";
import { gridSummary, type Grid } from "../domain/grids";
import { label } from "../domain/catalog";
import { text } from "../types/model";
import { ExportMenu } from "./ExportMenu";
export function GridEvidence({
  student,
  from = "",
  to = "",
}: {
  student?: string;
  from?: string;
  to?: string;
}) {
  const { data, filters } = useData();
  const rows = (data.assessment_results ?? []).flatMap((r) => {
    const e = data.enrollments?.find((e) => e.id === r.enrollment_id),
      a = data.assessments?.find((a) => a.id === r.assessment_id),
      cls = data.classes?.find((c) => c.id === e?.class_id),
      assignment = data.teaching_assignments?.find(
        (t) => t.id === a?.teaching_assignment_id,
      ),
      subject = data.class_subjects?.find(
        (c) => c.id === assignment?.class_subject_id,
      )?.subject_id;
    if (
      !e ||
      !a?.grid_snapshot ||
      (student && e.student_id !== student) ||
      (filters.classId && e.class_id !== filters.classId) ||
      (filters.year && cls?.school_year_id !== filters.year) ||
      (filters.subject && subject !== filters.subject) ||
      (from && text(a, "assessed_on") < from) ||
      (to && text(a, "assessed_on") > to)
    )
      return [];
    return gridSummary(
      a.grid_snapshot as Grid,
      data.question_results ?? [],
      r.id,
    ).skills.map((s) => ({
      Studente: label("enrollments", e, data),
      Prova: text(a, "title"),
      Competenza: s.label,
      PuntiAnalitici: s.obtained,
      Massimo: s.available,
      DettaglioMancante: s.missing,
      Stato: s.missing
        ? "Evidenze parziali: nessuna stima dal punteggio rapido"
        : "Dettaglio completo",
    }));
  });
  if (!rows.length) return null;
  return (
    <section className="card">
      <h2>Competenze delle griglie universali</h2>
      <p>
        Le evidenze derivano dai sottocriteri registrati. I totali rapidi non
        generano punteggi analitici; il voto confermato rimane nel registro
        canonico.
      </p>
      <ExportMenu title="Evidenze griglie" rows={rows} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {[
                "Studente",
                "Prova",
                "Competenza",
                "Punti",
                "Massimo",
                "Stato",
              ].map((s) => (
                <th key={s}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.Studente}</td>
                <td>{r.Prova}</td>
                <td>{r.Competenza}</td>
                <td>{r.PuntiAnalitici}</td>
                <td>{r.Massimo}</td>
                <td>{r.Stato}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
