import { Link } from "react-router-dom";
import { GridEvidence } from "./GridEvidence";
import { useData, useRows } from "../state/data";
import { text, type Row } from "../types/model";
import { tr } from "../domain/catalog";
import { ExportMenu } from "./ExportMenu";
import { ErrorBox } from "./ui";
export function StudentHistory({
  student,
  from,
  to,
}: {
  student: string;
  from: string;
  to: string;
}) {
  const { data } = useData();
  const homework = useRows("v_homework_summary");
  const activities = useRows("lesson_activities");
  const results = useRows("v_assessment_history");
  const enrollments = (data.enrollments ?? []).filter(
    (e) => e.student_id === student,
  );
  const ids = enrollments.map((e) => e.id);
  const within = (day: string) => (!from || day >= from) && (!to || day <= to);
  const lessons = (data.lessons ?? []).filter(
    (l) =>
      enrollments.some(
        (e) =>
          e.class_id ===
            data.teaching_assignments?.find(
              (t) => t.id === l.teaching_assignment_id,
            )?.class_id &&
          text(l, "starts_at").slice(0, 10) >= text(e, "starts_on") &&
          (!e.ends_on ||
            text(l, "starts_at").slice(0, 10) <= text(e, "ends_on")),
      ) && within(text(l, "starts_at").slice(0, 10)),
  );
  const checks = (data.homework_checks ?? []).filter(
    (c) =>
      ids.includes(text(c, "enrollment_id")) && within(text(c, "checked_on")),
  );
  const assessments = (results.data ?? []).filter(
    (r) =>
      ids.includes(text(r, "enrollment_id")) && within(text(r, "assessed_on")),
  );
  const history: Record<string, string>[] = [
    ...lessons.map((l) => ({
      Data: text(l, "starts_at").slice(0, 10),
      Tipo: "Lezione",
      Titolo: text(l, "title"),
      Dettagli: (activities.data ?? [])
        .filter((a) => a.lesson_id === l.id && !a.deleted_at)
        .map((a) => text(a, "description"))
        .join("; "),
    })),
    ...checks.map((c) => ({
      Data: text(c, "checked_on"),
      Tipo: "Compiti",
      Titolo: text(
        data.assignments?.find((a) => a.id === c.assignment_id),
        "title",
      ),
      Dettagli: details(c),
    })),
    ...assessments.map((a) => ({
      Data: text(a, "assessed_on"),
      Tipo: tr(text(a, "kind")),
      Titolo: text(a, "title"),
      Dettagli: text(a, "notes"),
    })),
  ].sort((a, b) => b.Data.localeCompare(a.Data));
  function details(c: Row) {
    const s = homework.data?.find((s) => s.homework_check_id === c.id);
    return c.excused
      ? "Giustificato: " + text(c, "excuse_reason")
      : "Completamento " +
          (text(s, "completed_percent") || "—") +
          "%. " +
          text(c, "notes") +
          " " +
          text(c, "suggestions");
  }
  return (
    <section className="card">
      <GridEvidence student={student} from={from} to={to} />
      <div className="section-toolbar">
        <h2>Lezioni, compiti e prove</h2>
        <ExportMenu title="Storico didattico studente" rows={history} />
      </div>
      <ErrorBox error={homework.error ?? activities.error ?? results.error} />
      {history.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Attività</th>
                <th>Dettagli</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r, i) => (
                <tr key={i}>
                  <td>{r.Data}</td>
                  <td>{r.Tipo}</td>
                  <td>{r.Titolo}</td>
                  <td>{r.Dettagli}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>Nessuna attività nel periodo selezionato.</p>
      )}
      <Link className="button" to="/osservazioni">
        Aggiungi un’annotazione
      </Link>
    </section>
  );
}
