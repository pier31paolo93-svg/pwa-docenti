import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useData } from "../state/data";
import { label } from "../domain/catalog";
import { orderedEnrollments } from "../domain/register";
import { confirmedStatistics, assessmentProgress } from "../domain/teaching";
import { gridSummary, units, type Grid } from "../domain/grids";
import { inContext } from "../domain/context";
import { text } from "../types/model";
import { PageTitle, Stat } from "../components/ui";
import { ExportMenu } from "../components/ExportMenu";
export function AssessmentAnalysis() {
  const { id } = useParams(),
    { data, filters } = useData(),
    [selected, setSelected] = useState(id ?? "");
  const assessments =
      data.assessments?.filter((a) => inContext(a, data, filters)) ?? [],
    assessment = assessments.find((a) => a.id === selected) ?? assessments[0];
  const results =
      data.assessment_results?.filter(
        (r) => r.assessment_id === assessment?.id,
      ) ?? [],
    grades =
      data.grade_entries?.filter((g) =>
        results.some(
          (r) => r.id === g.assessment_result_id && r.attendance !== "absent",
        ),
      ) ?? [],
    rule =
      (assessment?.grid_snapshot as Grid | undefined)?.rule ??
      data.evaluation_rules?.find(
        (r) => r.id === assessment?.evaluation_rule_id,
      ),
    stats = confirmedStatistics(grades, Number(rule?.pass_mark ?? 6));
  const roster = orderedEnrollments(
      (data.enrollments ?? []).filter(
        (e) =>
          e.class_id === assessment?.class_id &&
          text(e, "starts_on") <= text(assessment, "assessed_on") &&
          (!e.ends_on || text(e, "ends_on") >= text(assessment, "assessed_on")),
      ),
      data,
    ),
    rows = assessment
      ? roster.map((e) => ({
          Studente: label("enrollments", e, data),
          Stato: assessmentProgress(assessment, e, data),
          Voto:
            (grades.find(
              (g) =>
                g.status === "confirmed" &&
                results.some(
                  (r) =>
                    r.enrollment_id === e.id && r.id === g.assessment_result_id,
                ),
            )?.confirmed_value as number) ?? null,
        }))
      : [];
  const grid = assessment?.grid_snapshot as Grid | undefined,
    details = grid
      ? results
          .filter((r) => r.attendance !== "absent")
          .map((r) => gridSummary(grid, data.question_results ?? [], r.id))
      : [];
  const exercises = (
    grid
      ? grid.sections.flatMap((s) => s.exercises)
      : (data.assessment_questions ?? [])
          .filter(
            (q) =>
              q.assessment_id === assessment?.id &&
              !data.assessment_questions?.some(
                (child) => child.parent_question_id === q.id,
              ),
          )
          .map((q) => ({
            id: q.id,
            label: text(q, "label"),
            maximum: text(q, "max_score"),
          }))
  )
    .map((e) => {
      const corrected = (data.question_results ?? []).filter(
        (q) =>
          q.question_id === e.id &&
          q.score != null &&
          results.some(
            (r) => r.id === q.assessment_result_id && r.attendance !== "absent",
          ),
      );
      return {
        ...e,
        count: corrected.length,
        average: corrected.length
          ? corrected.reduce(
              (n, q) => n + Number(q.score) / Number(e.maximum),
              0,
            ) / corrected.length
          : null,
      };
    })
    .sort((a, b) => (a.average ?? Infinity) - (b.average ?? Infinity));
  return (
    <>
      <PageTitle
        title="Analisi verifiche"
        subtitle="Statistiche descrittive sui soli voti confermati; assenze e correzioni incomplete restano distinte."
      />
      <label>
        Verifica da analizzare
        <select
          aria-label="Verifica da analizzare"
          value={assessment?.id ?? ""}
          onChange={(e) => setSelected(e.target.value)}
        >
          {assessments.map((a) => (
            <option key={a.id} value={a.id}>
              {text(a, "title")}
            </option>
          ))}
        </select>
      </label>
      {assessment && (
        <Link className="button" to={"/verifiche/" + assessment.id}>
          Apri correzione
        </Link>
      )}
      <div className="stats-grid">
        <Stat label="Valutati" value={String(stats.count)} />
        <Stat label="Media" value={stats.mean?.toFixed(2) ?? "—"} />
        <Stat label="Mediana" value={stats.median?.toFixed(2) ?? "—"} />
        <Stat
          label="Minimo / massimo"
          value={
            stats.minimum == null ? "—" : `${stats.minimum} / ${stats.maximum}`
          }
        />
        <Stat
          label="Sufficienze"
          value={
            stats.passPercent == null ? "—" : stats.passPercent.toFixed(1) + "%"
          }
        />
      </div>
      <p>
        Soglia di sufficienza: {String(rule?.pass_mark ?? 6)}{" "}
        {rule?.pass_mark == null
          ? "(soglia descrittiva 6, non configurata nella regola storica)"
          : ""}
        .
      </p>
      {stats.small && (
        <p role="status">
          Campione insufficiente per generalizzare: {stats.count} voti
          confermati. Nessuna etichetta sulle capacità degli studenti.
        </p>
      )}
      <section className="card">
        <h2>Stato delle prove</h2>
        {[
          ["absent", "Assenti"],
          ["uncorrected", "Non ancora corrette"],
          ["incomplete", "Incomplete"],
          ["draft", "Bozze complete"],
          ["confirmed", "Voti confermati"],
        ].map(([state, name]) => (
          <p key={state}>
            {name}: {rows.filter((r) => r.Stato === state).length}
          </p>
        ))}
        <ExportMenu
          title={text(assessment, "title") || "Analisi verifiche"}
          rows={rows}
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Studente</th>
                <th>Stato</th>
                <th>Voto confermato</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.Studente}>
                  <td>{r.Studente}</td>
                  <td>{r.Stato}</td>
                  <td>{r.Voto ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h2>Distribuzione dei voti confermati</h2>
        {stats.count ? (
          stats.distribution
            .filter((b) => b.count)
            .map((b) => (
              <p key={b.grade}>
                {b.grade}: <meter min={0} max={stats.count} value={b.count} />
                {b.count}
              </p>
            ))
        ) : (
          <p>Dati insufficienti: nessun voto confermato.</p>
        )}
      </section>
      <section className="card">
        <h2>Esercizi da approfondire</h2>
        <p>
          Ordine crescente per percentuale di punti: descrive le correzioni
          disponibili, incluse le bozze esplicite.
        </p>
        {exercises.length ? (
          exercises.map((e) => (
            <p key={e.id}>
              {e.label}:{" "}
              {e.average == null
                ? "Dati insufficienti"
                : `${(e.average * 100).toFixed(1)}% su ${e.count} correzioni${e.count < 3 ? " (campione ridotto)" : ""}`}
            </p>
          ))
        ) : (
          <p>Nessun esercizio strutturato disponibile.</p>
        )}
      </section>
      {grid && (
        <section className="card">
          <h2>Competenze: solo evidenze analitiche</h2>
          {grid.competencies.map((c) => {
            const evidence = details
              .flatMap((s) => s.skills)
              .filter((s) => s.id === c.id && !s.missing);
            return (
              <p key={c.id}>
                {c.label}:{" "}
                {evidence.length
                  ? `${((evidence.reduce((n, s) => n + units(s.obtained) / units(s.available), 0) / evidence.length) * 100).toFixed(1)}% su ${evidence.length} dettagli completi`
                  : "Dettaglio non disponibile; nessuna stima dai voti globali."}
              </p>
            );
          })}
          <p>
            Le percentuali descrivono le evidenze registrate; il docente decide
            eventuali recuperi.
          </p>
          <Link className="button" to="/recupero">
            Pianifica attività di recupero
          </Link>
        </section>
      )}
    </>
  );
}
