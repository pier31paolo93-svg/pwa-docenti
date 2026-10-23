import { PeriodAverage } from "../components/PeriodAverage";
import { GridEvidence } from "../components/GridEvidence";
import { CanonicalDashboards } from "../components/CanonicalDashboards";
import { StudentHistory } from "../components/StudentHistory";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { useRows, useData } from "../state/data";
import { label, tr } from "../domain/catalog";
import { text, type Row } from "../types/model";
import { PageTitle, ErrorBox, Stat, Empty } from "../components/ui";
import { ExportMenu } from "../components/ExportMenu";
export function Statistics({ student = false }: { student?: boolean }) {
  const { id } = useParams();
  const { data, filters } = useData();
  const grades = useRows("v_grade_register");
  const averages = useRows("v_student_averages");
  const errors = useRows("v_recurring_errors");
  const homework = useRows("v_homework_summary");
  const competencies = useRows("v_competency_progress");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const pupil = data.students?.find((s) => s.id === id);
  const enrolled = (data.enrollments ?? []).filter((e) => e.student_id === id);
  const enrollmentIds = enrolled.map((e) => e.id);
  const selected = (r: Row) =>
    (!student ||
      r.student_id === id ||
      enrollmentIds.includes(text(r, "enrollment_id"))) &&
    (!filters.classId ||
      r.class_id === filters.classId ||
      (!r.class_id &&
        data.enrollments?.some(
          (e) =>
            e.student_id === r.student_id && e.class_id === filters.classId,
        ))) &&
    (!(subject || filters.subject) ||
      r.subject_id === (subject || filters.subject)) &&
    (!filters.year || r.school_year_id === filters.year) &&
    (!category || r.category_id === category);
  const rows = (grades.data ?? []).filter(
    (r) =>
      selected(r) &&
      (!from || text(r, "graded_on") >= from) &&
      (!to || text(r, "graded_on") <= to),
  );
  const confirmed = rows.filter(
    (r) => r.status === "confirmed" && r.included_in_average,
  );
  const chronological = [...confirmed]
    .sort((a, b) => text(a, "graded_on").localeCompare(text(b, "graded_on")))
    .map((r) => ({
      data: text(r, "graded_on"),
      voto: Number(r.confirmed_value),
    }));
  const distribution = Object.entries(
    confirmed.reduce<Record<string, number>>((acc, r) => {
      const v = String(Math.floor(Number(r.confirmed_value)));
      acc[v] = (acc[v] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([voto, numero]) => ({ voto, numero }));
  const serverAverages = (averages.data ?? []).filter(selected);
  const observationRows = (data.observations ?? []).filter(
    (o) =>
      (student
        ? enrollmentIds.includes(text(o, "enrollment_id"))
        : !filters.classId || o.class_id === filters.classId) &&
      (!from || text(o, "observed_on") >= from) &&
      (!to || text(o, "observed_on") <= to),
  );
  const studentErrors = (errors.data ?? []).filter(
    (e) => !student || enrollmentIds.includes(text(e, "enrollment_id")),
  );
  const homeworkRows = (homework.data ?? []).filter(
    (h) => !student || enrollmentIds.includes(text(h, "enrollment_id")),
  );
  const exports = rows.map((r) => ({
    Studente: label(
      "students",
      data.students?.find((s) => s.id === r.student_id) ?? r,
      data,
    ),
    Data: text(r, "graded_on"),
    Materia: text(
      data.subjects?.find((s) => s.id === r.subject_id),
      "name",
    ),
    Categoria: text(
      data.evaluation_categories?.find((s) => s.id === r.category_id),
      "name",
    ),
    Voto: text(r, "confirmed_value"),
    Peso: text(r, "weight"),
    Stato: tr(text(r, "status")),
    Incluso: r.included_in_average ? "Sì" : "No",
  }));
  const studentExport =
    student && pupil
      ? [
          {
            Sezione: "Anagrafica",
            Data: "",
            Descrizione: label("students", pupil, data),
            Valore: text(pupil, "external_code"),
          },
          ...enrolled.map((e) => ({
            Sezione: "Iscrizione",
            Data: text(e, "starts_on"),
            Descrizione: text(
              data.classes?.find((c) => c.id === e.class_id),
              "name",
            ),
            Valore: text(e, "ends_on") || "In corso",
          })),
          ...exports.map((g) => ({
            Sezione: "Voto",
            Data: g.Data,
            Descrizione: g.Materia + " · " + g.Categoria + " · " + g.Stato,
            Valore:
              g.Voto + " (peso " + g.Peso + ", incluso: " + g.Incluso + ")",
          })),
          ...serverAverages.map((a) => ({
            Sezione: "Media annuale",
            Data: text(
              data.school_years?.find((y) => y.id === a.school_year_id),
              "label",
            ),
            Descrizione:
              text(
                data.subjects?.find((s) => s.id === a.subject_id),
                "name",
              ) +
              " · " +
              text(
                data.evaluation_categories?.find((c) => c.id === a.category_id),
                "name",
              ),
            Valore: text(a, "weighted_average"),
          })),
          ...observationRows.map((o) => ({
            Sezione: "Osservazione",
            Data: text(o, "observed_on"),
            Descrizione: tr(text(o, "mode")),
            Valore: [
              "notes",
              "participation",
              "observable_behaviors",
              "difficulties",
              "strengths",
            ]
              .map((k) => text(o, k))
              .filter(Boolean)
              .join("; "),
          })),
          ...homeworkRows.map((h) => ({
            Sezione: "Compiti",
            Data: "",
            Descrizione: text(
              data.assignments?.find((a) => a.id === h.assignment_id),
              "title",
            ),
            Valore: text(h, "completed_percent") + "% svolti",
          })),
          ...studentErrors.map((e) => ({
            Sezione: "Errore ricorrente",
            Data: "",
            Descrizione: text(
              data.error_types?.find((t) => t.id === e.error_type_id),
              "description",
            ),
            Valore: text(e, "occurrences"),
          })),
        ]
      : [];
  return (
    <>
      {!student && <GridEvidence from={from} to={to} />}
      {student && (
        <Link className="back-link" to="/studenti">
          ← Studenti
        </Link>
      )}
      <PageTitle
        eyebrow={student ? "SCHEDA INDIVIDUALE" : "UNO SGUARDO D’INSIEME"}
        title={
          student
            ? pupil
              ? label("students", pupil, data)
              : "Scheda studente"
            : "Statistiche"
        }
        subtitle="Medie fornite dalle viste protette del database. Solo voti confermati e inclusi contribuiscono al calcolo."
        action={
          <ExportMenu
            title={student ? "Scheda studente" : "Registro voti"}
            rows={student ? studentExport : exports}
          />
        }
      />
      <ErrorBox error={grades.error ?? averages.error} />
      {!student && <CanonicalDashboards />}
      <div className="section-toolbar">
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
        <label>
          Materia
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">Dal filtro generale</option>
            {data.subjects?.map((s) => (
              <option value={s.id} key={s.id}>
                {text(s, "name")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Categoria
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Tutte</option>
            {data.evaluation_categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {text(c, "name")}
              </option>
            ))}
          </select>
        </label>
      </div>
      {student && (
        <PeriodAverage
          student={id!}
          subject={subject || filters.subject}
          from={from}
          to={to}
          category={category}
          year={filters.year}
        />
      )}
      <div className="stats-grid">
        <Stat
          label="Voti inclusi nel periodo"
          value={grades.isPending ? "…" : confirmed.length}
        />
        <Stat
          label="Osservazioni consultabili"
          value={observationRows.length}
        />
        <Stat label="Controlli compiti" value={homeworkRows.length} />
      </div>
      <div className="dashboard-columns">
        <section className="card">
          <h2>Andamento dei voti</h2>
          {chronological.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chronological}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="voto"
                  stroke="#236650"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p>Nessun voto confermato nel periodo selezionato.</p>
          )}
        </section>
        <section className="card">
          <h2>Distribuzione</h2>
          {distribution.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={distribution}>
                <XAxis dataKey="voto" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="numero" fill="#236650" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p>Il grafico apparirà dopo la prima conferma.</p>
          )}
        </section>
      </div>
      <section className="card">
        <h2>Medie per materia, anno e categoria</h2>
        <p className="muted">
          Questa vista riporta l’intero anno scolastico; i filtri Dal/Al si
          applicano al registro e ai grafici soprastanti.
        </p>
        {serverAverages.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Studente</th>
                  <th>Materia</th>
                  <th>Anno</th>
                  <th>Categoria</th>
                  <th>Media ponderata</th>
                  <th>Voti</th>
                </tr>
              </thead>
              <tbody>
                {serverAverages.map((r, i) => (
                  <tr key={i}>
                    <td>
                      {label(
                        "students",
                        data.students?.find((s) => s.id === r.student_id) ?? r,
                        data,
                      )}
                    </td>
                    <td>
                      {text(
                        data.subjects?.find((s) => s.id === r.subject_id),
                        "name",
                      )}
                    </td>
                    <td>
                      {text(
                        data.school_years?.find(
                          (s) => s.id === r.school_year_id,
                        ),
                        "label",
                      )}
                    </td>
                    <td>
                      {text(
                        data.evaluation_categories?.find(
                          (s) => s.id === r.category_id,
                        ),
                        "name",
                      )}
                    </td>
                    <td>
                      {Number(r.weighted_average).toLocaleString("it-IT", {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td>{text(r, "grade_count")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Nessuna media disponibile.</p>
        )}
      </section>
      <div className="dashboard-columns">
        <section className="card">
          <h2>Errori ricorrenti</h2>
          <ErrorBox error={errors.error} />
          {studentErrors.map((e, i) => (
            <p key={i}>
              {text(
                data.error_types?.find((t) => t.id === e.error_type_id),
                "description",
              )}{" "}
              · {text(e, "occurrences") || text(e, "error_count")}
            </p>
          ))}
          {!studentErrors.length && <p>Nessun errore classificato.</p>}
        </section>
        <section className="card">
          <h2>Competenze</h2>
          <ErrorBox error={competencies.error} />
          {competencies.data
            ?.filter(
              (c) =>
                !student || enrollmentIds.includes(text(c, "enrollment_id")),
            )
            .map((c, i) => (
              <p key={i}>
                {text(
                  data.competencies?.find((t) => t.id === c.competency_id),
                  "description",
                )}{" "}
                · {text(c, "average_ratio")}
              </p>
            ))}
        </section>
      </div>
      {student && (
        <>
          <StudentHistory student={id!} from={from} to={to} />
          <section className="card">
            <h2>Anagrafica e iscrizioni</h2>
            <p>
              {text(pupil, "first_name")} {text(pupil, "last_name")} · Codice{" "}
              {text(pupil, "external_code")}
            </p>
            {enrolled.map((e) => (
              <p key={e.id}>
                {text(
                  data.classes?.find((c) => c.id === e.class_id),
                  "name",
                )}{" "}
                · {text(e, "starts_on")} → {text(e, "ends_on") || "in corso"} ·{" "}
                {tr(text(e, "outcome"))}
              </p>
            ))}
          </section>
          <section className="card">
            <h2>Osservazioni e note</h2>
            {observationRows.map((o) => (
              <article className="history-item" key={o.id}>
                <strong>
                  {text(o, "observed_on")} · {tr(text(o, "mode"))}
                </strong>
                <p>{text(o, "notes")}</p>
                {[
                  "participation",
                  "observable_behaviors",
                  "difficulties",
                  "strengths",
                ].map((k) => (o[k] ? <p key={k}>{text(o, k)}</p> : null))}
              </article>
            ))}
            {!observationRows.length && (
              <Empty
                title="Nessuna osservazione"
                description="Le annotazioni della classe compariranno qui."
              />
            )}
          </section>
          <section className="card">
            <h2>Registro e storico voti</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Origine</th>
                    <th>Voto</th>
                    <th>Peso</th>
                    <th>Stato</th>
                    <th>Motivazione</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{text(r, "graded_on")}</td>
                      <td>{tr(text(r, "origin"))}</td>
                      <td>{text(r, "confirmed_value") || "—"}</td>
                      <td>{text(r, "weight")}</td>
                      <td>{tr(text(r, "status"))}</td>
                      <td>{text(r, "change_reason")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
