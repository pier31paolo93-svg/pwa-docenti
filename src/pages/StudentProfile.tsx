import { useState, lazy, Suspense } from "react";
import { Link, useParams } from "react-router-dom";
import { useData, useRows } from "../state/data";
import { useCapabilities } from "../hooks/capabilities";
import { GridEvidence } from "../components/GridEvidence";
import { PageTitle, Spinner } from "../components/ui";
import { label, tr } from "../domain/catalog";
import { text } from "../types/model";
import { assessmentProgress } from "../domain/teaching";
import { ExportMenu } from "../components/ExportMenu";
const Statistics = lazy(() =>
  import("./Statistics").then((m) => ({ default: m.Statistics })),
);
const sections = [
  "Profilo",
  "Iscrizioni e storico",
  "Voti e medie",
  "Verifiche",
  "Compiti",
  "Partecipazione",
  "Osservazioni",
  "Competenze",
  "Progressi nel tempo",
  "Recupero",
];
export function StudentProfile() {
  const { id } = useParams(),
    { data, filters } = useData(true),
    caps = useCapabilities(),
    [section, setSection] = useState("Profilo");
  const recovery = useRows("recovery_activities", !!caps.data?.recovery),
    targets = useRows("recovery_students", !!caps.data?.recovery),
    completion = useRows("v_homework_completion"),
    legacySkills = useRows("v_competency_progress");
  const pupil = data.students?.find((s) => s.id === id),
    enrollments = (data.enrollments ?? []).filter((e) => e.student_id === id),
    scoped = enrollments.filter((e) => {
      const c = data.classes?.find((c) => c.id === e.class_id);
      return (
        (!filters.classId || e.class_id === filters.classId) &&
        (!filters.year || c?.school_year_id === filters.year) &&
        (!filters.school || c?.school_id === filters.school)
      );
    }),
    ids = new Set(scoped.map((e) => e.id));
  const subjectAllowed = (assignment: unknown) =>
    !filters.subject ||
    data.class_subjects?.find(
      (cs) =>
        cs.id ===
        data.teaching_assignments?.find((t) => t.id === assignment)
          ?.class_subject_id,
    )?.subject_id === filters.subject;
  const observations = (data.observations ?? []).filter(
      (o) =>
        ids.has(text(o, "enrollment_id")) &&
        subjectAllowed(o.teaching_assignment_id),
    ),
    tests = (data.assessments ?? []).filter(
      (a) =>
        scoped.some((e) => e.class_id === a.class_id) &&
        subjectAllowed(a.teaching_assignment_id),
    ),
    checks = (data.homework_checks ?? []).filter(
      (h) =>
        ids.has(text(h, "enrollment_id")) &&
        subjectAllowed(
          data.assignments?.find((a) => a.id === h.assignment_id)
            ?.teaching_assignment_id,
        ),
    );
  return (
    <>
      <Link className="back-link" to="/studenti">
        ← Studenti
      </Link>
      <PageTitle
        title={
          pupil ? label("students", pupil, data) : "Studente non disponibile"
        }
        subtitle="I filtri anno, scuola, classe e materia si applicano alle sezioni didattiche. Lo storico delle iscrizioni resta consultabile."
      />
      <nav className="profile-sections" aria-label="Sezioni scheda studente">
        {sections.map((s) => (
          <button
            className={"button " + (s === section ? "primary" : "")}
            aria-pressed={s === section}
            key={s}
            onClick={() => setSection(s)}
          >
            {s}
          </button>
        ))}
      </nav>
      {section === "Profilo" && (
        <section className="card">
          <h2>Profilo e numero di registro</h2>
          <p>
            {pupil ? label("students", pupil, data) : "Accesso non disponibile"}
          </p>
          <p>Codice: {text(pupil, "external_code")}</p>
          {scoped.map((e) => (
            <p key={e.id}>{label("enrollments", e, data)}</p>
          ))}
        </section>
      )}
      {section === "Iscrizioni e storico" && (
        <section className="card">
          <h2>Iscrizioni e storico classi</h2>
          {enrollments.map((e) => (
            <p key={e.id}>
              {label("enrollments", e, data)} · {text(e, "starts_on")} —{" "}
              {text(e, "ends_on") || "In corso"} ·{" "}
              {text(e, "outcome") || "Non definito"}
            </p>
          ))}
        </section>
      )}
      {["Voti e medie", "Progressi nel tempo"].includes(section) && (
        <Suspense fallback={<Spinner />}>
          <Statistics student />
        </Suspense>
      )}
      {section === "Verifiche" && (
        <section className="card">
          <h2>Verifiche</h2>
          {tests.map((a) => (
            <p key={a.id}>
              <Link to={"/verifiche/" + a.id}>{text(a, "title")}</Link> ·{" "}
              {text(a, "assessed_on")} ·{" "}
              {tr(
                assessmentProgress(
                  a,
                  scoped.find((e) => e.class_id === a.class_id)!,
                  data,
                ),
              )}
            </p>
          ))}
          {!tests.length && (
            <p>Dati insufficienti: nessuna prova nel contesto selezionato.</p>
          )}
        </section>
      )}
      {section === "Compiti" && (
        <section className="card">
          <h2>Compiti</h2>
          <ExportMenu
            title="Compiti studente"
            rows={checks.map((h) => ({
              Compito: text(
                data.assignments?.find((a) => a.id === h.assignment_id),
                "title",
              ),
              Data: text(h, "checked_on"),
              Stato:
                text(
                  completion.data?.find((c) => c.id === h.id),
                  "completion_status",
                ) || "unchecked",
            }))}
          />
          {checks.map((h) => (
            <p key={h.id}>
              {text(
                data.assignments?.find((a) => a.id === h.assignment_id),
                "title",
              )}{" "}
              · {text(h, "checked_on")} ·{" "}
              {text(
                completion.data?.find((c) => c.id === h.id),
                "completion_status",
              ) || "Non controllato"}
            </p>
          ))}
        </section>
      )}
      {["Partecipazione", "Osservazioni"].includes(section) && (
        <section className="card">
          <h2>{section}</h2>
          {observations
            .filter((o) => section !== "Partecipazione" || !!o.participation)
            .map((o) => (
              <article key={o.id}>
                <p>
                  {text(o, "observed_on")} · {text(o, "participation")} ·{" "}
                  {text(o, "notes")}
                </p>
                <small>
                  {text(o, "visibility") === "private"
                    ? "Privata"
                    : "Condivisa"}
                </small>
              </article>
            ))}
          {!observations.length && (
            <p>
              Nessuna evidenza registrata; non viene attribuito un livello
              automatico.
            </p>
          )}
        </section>
      )}
      {section === "Competenze" && (
        <>
          <GridEvidence student={id} />
          <section className="card">
            <h2>Competenze del registro precedente</h2>
            {legacySkills.data
              ?.filter(
                (r) =>
                  ids.has(text(r, "enrollment_id")) &&
                  (!filters.subject ||
                    data.competencies?.find((c) => c.id === r.competency_id)
                      ?.subject_id === filters.subject),
              )
              .map((r, i) => (
                <p key={i}>
                  {text(
                    data.competencies?.find((c) => c.id === r.competency_id),
                    "description",
                  )}{" "}
                  ·{" "}
                  {r.average_ratio == null
                    ? "Dati insufficienti"
                    : `${(Number(r.average_ratio) * 100).toFixed(1)}% dei punti disponibili`}{" "}
                  · {text(r, "evidence_count")} evidenze registrate
                </p>
              ))}
          </section>
        </>
      )}
      {section === "Recupero" && (
        <section className="card">
          <h2>Attività di recupero</h2>
          {targets.data
            ?.filter((t) => !t.deleted_at && ids.has(text(t, "enrollment_id")))
            .map((t) => {
              const a = recovery.data?.find((a) => a.id === t.activity_id);
              if (
                !a ||
                a.deleted_at ||
                !subjectAllowed(a.teaching_assignment_id)
              )
                return null;
              return (
                <article key={t.id}>
                  <Link to={"/recupero?activity=" + a.id}>
                    {text(a, "title")}
                  </Link>
                  <p>
                    {text(a, "objective")} · {text(a, "due_on")} ·{" "}
                    {text(t, "status")} · {text(t, "outcome")}
                  </p>
                </article>
              );
            })}
          <Link className="button" to="/recupero">
            Gestisci recuperi
          </Link>
        </section>
      )}
    </>
  );
}
