import { useRows, useData } from "../state/data";
import { GridEvidence } from "./GridEvidence";
import { text } from "../types/model";
import { ErrorBox } from "./ui";
import { ExportMenu } from "./ExportMenu";
export function CanonicalDashboards() {
  const { data, filters } = useData();
  const classes = useRows("v_class_dashboard");
  const subjects = useRows("v_subject_dashboard");
  const c = (classes.data ?? []).filter(
    (r) =>
      (!filters.classId || r.class_id === filters.classId) &&
      (!filters.subject || r.subject_id === filters.subject) &&
      (!filters.year || r.school_year_id === filters.year),
  );
  const s = (subjects.data ?? []).filter(
    (r) =>
      (!filters.subject || r.subject_id === filters.subject) &&
      (!filters.year || r.school_year_id === filters.year),
  );
  const rows = [
    ...c.map((r) => ({
      Ambito: text(
        data.classes?.find((c) => c.id === r.class_id),
        "name",
      ),
      Materia: text(
        data.subjects?.find((s) => s.id === r.subject_id),
        "name",
      ),
      Anno: text(
        data.school_years?.find((y) => y.id === r.school_year_id),
        "label",
      ),
      Media: Number(r.weighted_average),
      Voti: Number(r.grade_count),
    })),
    ...s.map((r) => ({
      Ambito: "Tutte le classi",
      Materia: text(
        data.subjects?.find((s) => s.id === r.subject_id),
        "name",
      ),
      Anno: text(
        data.school_years?.find((y) => y.id === r.school_year_id),
        "label",
      ),
      Media: Number(r.weighted_average),
      Voti: Number(r.grade_count),
    })),
  ];
  return (
    <section className="card">
      <GridEvidence />
      <div className="section-toolbar">
        <h2>Medie di classe e materia</h2>
        <ExportMenu title="Riepilogo classi e materie" rows={rows} />
      </div>
      <p className="muted">
        Riepilogo annuale dalle viste canoniche; i filtri di periodo non
        modificano questa tabella.
      </p>
      <ErrorBox error={classes.error ?? subjects.error} />
      {rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {["Ambito", "Materia", "Anno", "Media", "Voti"].map((k) => (
                  <th key={k}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.Ambito}</td>
                  <td>{r.Materia}</td>
                  <td>{r.Anno}</td>
                  <td>
                    {r.Media.toLocaleString("it-IT", {
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td>{r.Voti}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>Nessuna media annuale disponibile.</p>
      )}
    </section>
  );
}
