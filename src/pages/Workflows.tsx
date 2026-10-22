import { CorrectionSummary } from "../components/CorrectionSummary";
import { HomeworkOverview } from "../components/HomeworkOverview";
import { useState, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { useData, useRows, useSyncState } from "../state/data";
import { useCompact } from "../hooks/viewport";
import { allowContextChange } from "../hooks/unsaved";
import { usePermissions } from "../hooks/permissions";
import { useCapabilities } from "../hooks/capabilities";
import { catalog, derivePatch, label, tr } from "../domain/catalog";
import {
  text,
  today,
  type Row,
  type Patch,
  type TableName,
} from "../types/model";
import { PageTitle, Empty, ErrorBox, Modal, Badge } from "../components/ui";
import { EntityForm } from "../components/EntityForm";
import { GradeEditor } from "../components/GradeEditor";
type Editor = { table: TableName; row?: Row; initial?: Patch };
export function Workflow() {
  const { id } = useParams();
  const path = location.hash.split("/")[1];
  const kind =
    path === "compiti"
      ? "assignments"
      : path === "verifiche"
        ? "assessments"
        : "lessons";
  const { data, save, online } = useData();
  const compact = useCompact();
  const ops = useSyncState();
  const [studentSearch, setStudentSearch] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [feedback, setFeedback] = useState("");
  const live = useRef<Record<string, Row>>({});
  const [undo, setUndo] = useState<
    { key: string; row: Row; previous: string } | undefined
  >();
  const { writable } = usePermissions();
  const capabilities = useCapabilities();
  const parent = data[kind]?.find((r) => r.id === id);
  const [edit, setEdit] = useState<Editor>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState("");
  const [localRows, setLocalRows] = useState<Record<string, Row>>({});
  const [graded, setGraded] = useState<Row>();
  const createdResults = useRef<Record<string, Row>>({});
  const topics = useRows(
    kind === "lessons" ? "lesson_topics" : "assignment_topics",
  );
  const activities = useRows("lesson_activities");
  const summaries = useRows("v_homework_summary");
  if (!parent)
    return (
      <Empty
        title="Caricamento o elemento non disponibile"
        description="Verifica i filtri e i permessi del workspace."
      />
    );
  const enrollments = (data.enrollments ?? [])
    .filter(
      (e) =>
        e.class_id === parent.class_id ||
        (kind === "lessons" &&
          e.class_id ===
            data.teaching_assignments?.find(
              (t) => t.id === parent.teaching_assignment_id,
            )?.class_id),
    )
    .filter(
      (e) =>
        !e.deleted_at &&
        label("enrollments", e, data)
          .toLocaleLowerCase()
          .includes(studentSearch.toLocaleLowerCase()),
    );
  const enrollment =
    enrollments.find((e) => e.id === selected) ?? enrollments[0];
  const results =
    kind === "assignments" ? "homework_checks" : "assessment_results";
  const result =
    data[results]?.find(
      (r) =>
        r[kind === "assignments" ? "assignment_id" : "assessment_id"] === id &&
        r.enrollment_id === enrollment?.id,
    ) ?? localRows[id! + (enrollment?.id ?? "")];
  const exercises = (data.assignment_exercises ?? [])
    .filter((e) => e.assignment_id === id)
    .sort((a, b) => Number(a.position) - Number(b.position));
  const questions = (data.assessment_questions ?? []).filter(
    (q) => q.assessment_id === id,
  );
  const leaves = questions.filter(
    (q) => !questions.some((child) => child.parent_question_id === q.id),
  );
  const criteria = (data.rubric_criteria ?? []).filter(
    (c) => c.rubric_id === parent.rubric_id,
  );
  const steps = parent.correction_mode === "rubric" ? criteria : leaves;
  const step = Math.min(questionIndex, Math.max(0, steps.length - 1));
  const visibleQuestions =
    compact && !showAll ? leaves.slice(step, step + 1) : leaves;
  const visibleCriteria =
    compact && !showAll ? criteria.slice(step, step + 1) : criteria;
  function latest(
    table: TableName,
    key: string,
    predicate: (r: Row) => boolean,
  ) {
    const remote = data[table]?.find(predicate),
      local = live.current[key];
    return Number(local?.version ?? 0) >= Number(remote?.version ?? 0)
      ? local
      : remote;
  }
  function exerciseResult(exerciseId: string) {
    return latest(
      "homework_exercise_results",
      `h:${result?.id}:${exerciseId}`,
      (r) => r.homework_check_id === result?.id && r.exercise_id === exerciseId,
    );
  }
  function chooseStudent(value: string) {
    if (!allowContextChange()) return;
    setSelected(value);
    setQuestionIndex(0);
    setUndo(undefined);
    setFeedback("");
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
      setFeedback(
        online && ops.length === 0
          ? "Modifica salvata. Puoi correggerla scegliendo un altro esito."
          : "Modifica salvata sul dispositivo; sincronizzazione in attesa.",
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function ensureResult() {
    if (result) return result;
    const cached = createdResults.current[id! + enrollment?.id];
    if (cached) return cached;
    if (!enrollment)
      throw new Error("Seleziona uno studente iscritto alla classe.");
    const patch = derivePatch(
      results,
      {
        [kind === "assignments" ? "assignment_id" : "assessment_id"]: id!,
        enrollment_id: enrollment.id,
        ...(kind === "assignments" ? { checked_on: today() } : {}),
        visibility: (parent!.visibility as string) ?? "workspace",
      },
      data,
    );
    const r = await save(results, patch);
    createdResults.current[id! + enrollment.id] = r;
    setLocalRows((old) => ({ ...old, [id! + enrollment.id]: r }));
    return r;
  }
  async function outcome(exercise: Row, value: string) {
    const check = await ensureResult();
    const key = `h:${check.id}:${exercise.id}`;
    const existing = latest(
      "homework_exercise_results",
      key,
      (r) => r.homework_check_id === check.id && r.exercise_id === exercise.id,
    );
    const saved = await save(
      "homework_exercise_results",
      existing
        ? { outcome: value }
        : {
            homework_check_id: check.id,
            assignment_id: id!,
            exercise_id: exercise.id,
            outcome: value,
            visibility: (check.visibility as string) ?? "workspace",
          },
      existing,
    );
    live.current[key] = saved;
    setUndo({
      key,
      row: saved,
      previous: String(existing?.outcome ?? "not_done"),
    });
  }
  async function correct(question: Row, value: string) {
    const r = await ensureResult();
    const key = `q:${r.id}:${question.id}`;
    const existing = latest(
      "question_results",
      key,
      (x) => x.assessment_result_id === r.id && x.question_id === question.id,
    );
    const p =
      parent!.correction_mode === "quick"
        ? { quick_result: value, score: null }
        : { score: Number(value), quick_result: null };
    if (
      parent!.correction_mode !== "quick" &&
      (!Number.isFinite(Number(value)) ||
        Number(value) < 0 ||
        Number(value) >
          Number(existing?.max_score_snapshot ?? question.max_score))
    )
      throw new Error(
        "Indica un punteggio compreso tra zero e il massimo del quesito.",
      );
    const saved = await save(
      "question_results",
      existing
        ? p
        : {
            ...p,
            assessment_result_id: r.id,
            assessment_id: id!,
            question_id: question.id,
            max_score_snapshot: Number(question.max_score),
            visibility: (r.visibility as string) ?? "workspace",
          },
      existing,
    );
    live.current[key] = saved;
  }
  async function rubric(c: Row, value: string) {
    const r = await ensureResult();
    const key = `r:${r.id}:${c.id}`;
    const existing = latest(
      "rubric_scores",
      key,
      (x) => x.assessment_result_id === r.id && x.criterion_id === c.id,
    );
    if (
      !Number.isFinite(Number(value)) ||
      Number(value) < 0 ||
      Number(value) > Number(existing?.max_score_snapshot ?? c.max_score)
    )
      throw new Error(
        "Indica un punteggio compreso tra zero e il massimo del criterio.",
      );
    const saved = await save(
      "rubric_scores",
      existing
        ? { score: Number(value) }
        : derivePatch(
            "rubric_scores",
            {
              assessment_result_id: r.id,
              criterion_id: c.id,
              score: Number(value),
              visibility: (r.visibility as string) ?? "workspace",
            },
            data,
          ),
      existing,
    );
    live.current[key] = saved;
  }
  const editor = (table: TableName, initial: Patch, row?: Row) =>
    setEdit({ table, initial, row });
  return (
    <>
      <Link className="back-link" to={"/" + path}>
        ← Torna all’elenco
      </Link>
      <PageTitle
        eyebrow={
          kind === "lessons"
            ? "REGISTRO"
            : kind === "assignments"
              ? "CONTROLLO COMPITI"
              : "CORREZIONE GUIDATA"
        }
        title={text(parent, "title")}
        subtitle={label(
          "teaching_assignments",
          data.teaching_assignments?.find(
            (t) => t.id === parent.teaching_assignment_id,
          ) ?? parent,
          data,
        )}
        action={
          writable(kind, parent) && (
            <button className="button" onClick={() => editor(kind, {}, parent)}>
              Modifica dettagli
            </button>
          )
        }
      />
      <ErrorBox error={error} />
      <div className="workflow-context">
        <strong>
          {label(
            "teaching_assignments",
            data.teaching_assignments?.find(
              (t) => t.id === parent.teaching_assignment_id,
            ) ?? parent,
            data,
          )}
        </strong>
        <p role="status" className="quick-feedback" aria-live="polite">
          {busy
            ? "Salvataggio in corso…"
            : feedback ||
              (!online
                ? "Offline: le modifiche vengono conservate nella coda cifrata."
                : "Pronto per la lezione")}
        </p>
      </div>
      {kind === "lessons" ? (
        <>
          <div className="dashboard-columns">
            <section className="card">
              <h2>Attività svolte</h2>
              <p>{text(parent, "notes") || "Nessuna annotazione."}</p>
              {activities.data
                ?.filter((a) => a.lesson_id === id && !a.deleted_at)
                .map((a) => (
                  <p key={a.id}>
                    {text(a, "description")}{" "}
                    {writable("lesson_activities", a) && (
                      <button
                        className="button"
                        onClick={() => editor("lesson_activities", {}, a)}
                      >
                        Modifica
                      </button>
                    )}
                  </p>
                ))}
              {writable("lesson_activities") && (
                <button
                  className="button"
                  onClick={() =>
                    editor("lesson_activities", { lesson_id: id! })
                  }
                >
                  Aggiungi attività
                </button>
              )}
            </section>
            <section className="card">
              <h2>Argomenti</h2>
              {topics.data
                ?.filter((t) => t.lesson_id === id && !t.deleted_at)
                .map((t) => (
                  <p key={t.id}>
                    {text(
                      data.topics?.find((x) => x.id === t.topic_id),
                      "name",
                    )}
                  </p>
                ))}
              {writable("lesson_topics") && (
                <button
                  className="button"
                  onClick={() => editor("lesson_topics", { lesson_id: id! })}
                >
                  Collega argomento
                </button>
              )}
              <Link className="button" to="/compiti">
                Compiti della classe
              </Link>
            </section>
          </div>
          <h2>Studenti della classe</h2>
          <div className="student-grid">
            {enrollments.map((e) => (
              <article className="card" key={e.id}>
                <Link to={"/studenti/" + text(e, "student_id")}>
                  {label("enrollments", e, data)}
                </Link>
                {writable("observations") && (
                  <button
                    className="button"
                    onClick={() =>
                      editor("observations", {
                        teaching_assignment_id: text(
                          parent,
                          "teaching_assignment_id",
                        ),
                        enrollment_id: e.id,
                      })
                    }
                  >
                    Annota osservazione
                  </button>
                )}
              </article>
            ))}
          </div>
        </>
      ) : (
        <>
          {kind === "assignments" && (
            <section className="card">
              <h2>Argomenti della consegna</h2>
              {topics.data
                ?.filter((t) => t.assignment_id === id && !t.deleted_at)
                .map((t) => (
                  <p key={t.id}>
                    {text(
                      data.topics?.find((x) => x.id === t.topic_id),
                      "name",
                    )}
                  </p>
                ))}
              {writable("assignment_topics") && (
                <button
                  className="button"
                  onClick={() =>
                    editor("assignment_topics", { assignment_id: id! })
                  }
                >
                  Collega argomento
                </button>
              )}
            </section>
          )}
          <section className="card">
            <div className="section-toolbar">
              <h2>
                {kind === "assignments"
                  ? "Esercizi assegnati"
                  : parent.correction_mode === "rubric"
                    ? "Criteri della rubrica"
                    : "Quesiti della prova"}
              </h2>
              {writable(kind, parent) &&
                parent.correction_mode !== "rubric" && (
                  <button
                    className="button"
                    onClick={() =>
                      editor(
                        kind === "assignments"
                          ? "assignment_exercises"
                          : "assessment_questions",
                        {
                          [kind === "assignments"
                            ? "assignment_id"
                            : "assessment_id"]: id!,
                        },
                      )
                    }
                  >
                    Aggiungi {kind === "assignments" ? "esercizio" : "quesito"}
                  </button>
                )}
            </div>
            {(kind === "assignments"
              ? exercises
              : parent.correction_mode === "rubric"
                ? criteria
                : questions
            ).map((r) => (
              <div className="list-row" key={r.id}>
                <span>
                  {text(r, "description") || text(r, "label")}{" "}
                  {r.max_score != null && (
                    <Badge>max {text(r, "max_score")}</Badge>
                  )}
                </span>
                {writable(kind, parent) && (
                  <button
                    className="button"
                    onClick={() =>
                      editor(
                        kind === "assignments"
                          ? "assignment_exercises"
                          : parent.correction_mode === "rubric"
                            ? "rubric_criteria"
                            : "assessment_questions",
                        {},
                        r,
                      )
                    }
                  >
                    Modifica
                  </button>
                )}
              </div>
            ))}
            {kind === "assessments" &&
              parent.correction_mode === "rubric" &&
              !criteria.length && (
                <p>
                  Configura la rubrica e i criteri in{" "}
                  <Link to="/archivio/rubric_criteria">Organizzazione</Link>.
                </p>
              )}
          </section>
          {kind === "assignments" && <HomeworkOverview assignment={parent} />}
          <section className="card">
            <div className="student-toolbar workflow-student">
              <label>
                Cerca studente nella classe
                <input
                  type="search"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Nome o cognome"
                />
              </label>
              <label>
                Studente da correggere
                <select
                  value={enrollment?.id ?? ""}
                  onChange={(e) => chooseStudent(e.target.value)}
                >
                  {enrollments.map((e) => (
                    <option value={e.id} key={e.id}>
                      {label("enrollments", e, data)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="student-next">
                <button
                  className="button"
                  disabled={busy || !enrollments.length}
                  onClick={() =>
                    chooseStudent(
                      enrollments[
                        (enrollments.findIndex((e) => e.id === enrollment?.id) -
                          1 +
                          enrollments.length) %
                          enrollments.length
                      ].id,
                    )
                  }
                >
                  ← Precedente
                </button>
                <span>
                  {enrollments.length
                    ? enrollments.findIndex((e) => e.id === enrollment?.id) + 1
                    : 0}{" "}
                  / {enrollments.length}
                </span>
                <button
                  className="button"
                  disabled={busy || !enrollments.length}
                  onClick={() =>
                    chooseStudent(
                      enrollments[
                        (enrollments.findIndex((e) => e.id === enrollment?.id) +
                          1) %
                          enrollments.length
                      ].id,
                    )
                  }
                >
                  Studente successivo →
                </button>
              </div>
            </div>
            {!enrollment ? (
              <p>Non ci sono iscrizioni per questa classe.</p>
            ) : kind === "assignments" ? (
              <>
                <p>
                  Gli esercizi senza esito risultano non svolti nel riepilogo.
                  Le percentuali sono calcolate dal database.
                </p>
                <div className="quick-buttons">
                  {["correct", "partial", "not_done"].map((value) => (
                    <button
                      key={value}
                      className="button"
                      disabled={
                        busy ||
                        !writable("homework_checks", result) ||
                        !exercises.length
                      }
                      onClick={() =>
                        void run(async () => {
                          for (const e of exercises) await outcome(e, value);
                        })
                      }
                    >
                      Tutti: {tr(value)}
                    </button>
                  ))}
                </div>
                <div className="quick-buttons">
                  {["correct", "partial", "wrong"].map((value) => {
                    const matching = exercises.filter(
                      (e) => exerciseResult(e.id)?.outcome === value,
                    );
                    return (
                      <div className="counter" key={value}>
                        <span>
                          {tr(value)}: {matching.length}
                        </span>
                        <button
                          className="button"
                          aria-label={"Diminuisci " + tr(value)}
                          disabled={
                            busy ||
                            !matching.length ||
                            !writable("homework_checks", result)
                          }
                          onClick={() =>
                            void run(() =>
                              outcome(
                                matching[matching.length - 1],
                                "not_done",
                              ),
                            )
                          }
                        >
                          −
                        </button>
                        <button
                          className="button"
                          aria-label={"Aumenta " + tr(value)}
                          disabled={
                            busy ||
                            matching.length === exercises.length ||
                            !writable("homework_checks", result)
                          }
                          onClick={() => {
                            const next = exercises.find(
                              (e) => !matching.some((m) => m.id === e.id),
                            );
                            if (next) void run(() => outcome(next, value));
                          }}
                        >
                          +
                        </button>
                      </div>
                    );
                  })}
                </div>
                {exercises.map((e) => {
                  const r = exerciseResult(e.id);
                  return (
                    <div className="correction-row" key={e.id}>
                      <strong>{text(e, "description")}</strong>
                      <div className="quick-buttons">
                        {["correct", "partial", "wrong", "not_done"].map(
                          (v) => (
                            <button
                              className={
                                "button " + (r?.outcome === v ? "selected" : "")
                              }
                              disabled={
                                busy || !writable("homework_checks", result)
                              }
                              key={v}
                              aria-pressed={r?.outcome === v}
                              onClick={() => void run(() => outcome(e, v))}
                            >
                              {tr(v)}
                            </button>
                          ),
                        )}
                        {r && (
                          <button
                            className="button"
                            onClick={() =>
                              editor("homework_errors", {
                                exercise_result_id: r.id,
                              })
                            }
                          >
                            Tipo di errore
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {undo && (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const restored = await save(
                          "homework_exercise_results",
                          { outcome: undo.previous },
                          undo.row,
                        );
                        live.current[undo.key] = restored;
                        setUndo(undefined);
                      })
                    }
                  >
                    Ripristina ultimo esercizio
                  </button>
                )}
                {result && (
                  <>
                    <p>
                      Completamento:{" "}
                      {text(
                        summaries.data?.find(
                          (s) => s.homework_check_id === result.id,
                        ),
                        "completed_percent",
                      ) || "—"}
                      %
                    </p>
                    <button
                      className="button"
                      onClick={() => editor("homework_checks", {}, result)}
                    >
                      Autonomia, comprensione e note
                    </button>
                    {capabilities.data?.extendedHomework && (
                      <button
                        className="button"
                        disabled={busy || !writable("homework_checks", result)}
                        onClick={() =>
                          void run(async () => {
                            const reason = window.prompt(
                              "Motivo della giustificazione",
                            );
                            if (reason?.trim()) {
                              const r = await save(
                                "homework_checks",
                                { excused: true, excuse_reason: reason },
                                result,
                              );
                              setLocalRows((old) => ({
                                ...old,
                                [id! + enrollment.id]: r,
                              }));
                            }
                          })
                        }
                      >
                        Giustifica
                      </button>
                    )}
                    {!!result.excused && (
                      <Badge tone="warn">
                        Giustificato: {text(result, "excuse_reason")}
                      </Badge>
                    )}
                    <button
                      className="button"
                      onClick={() => setGraded(result)}
                    >
                      Valuta i compiti
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <CorrectionSummary assessment={parent} result={result} />
                {compact && steps.length > 0 && (
                  <div className="question-stepper">
                    <button
                      className="button"
                      disabled={busy || step === 0}
                      onClick={() => setQuestionIndex(step - 1)}
                      aria-label="Quesito precedente"
                    >
                      ←
                    </button>
                    <span>
                      {parent.correction_mode === "rubric"
                        ? "Criterio"
                        : "Quesito"}{" "}
                      {step + 1} di {steps.length}
                      <br />
                      <button
                        className="text-button"
                        onClick={() => setShowAll((v) => !v)}
                      >
                        {showAll ? "Un quesito alla volta" : "Mostra tutti"}
                      </button>
                    </span>
                    <button
                      className="button"
                      disabled={busy || step === steps.length - 1}
                      onClick={() => setQuestionIndex(step + 1)}
                      aria-label="Quesito successivo"
                    >
                      →
                    </button>
                  </div>
                )}
                {parent.correction_mode === "rubric"
                  ? visibleCriteria.map((c) => {
                      const r = latest(
                        "rubric_scores",
                        `r:${result?.id}:${c.id}`,
                        (x) =>
                          x.assessment_result_id === result?.id &&
                          x.criterion_id === c.id,
                      );
                      return (
                        <label className="correction-row" key={c.id}>
                          {text(c, "label")} (max{" "}
                          {text(r ?? c, r ? "max_score_snapshot" : "max_score")}
                          )
                          <input
                            key={r?.version ?? c.id}
                            type="number"
                            inputMode="decimal"
                            defaultValue={text(r, "score")}
                            min="0"
                            max={Number(r?.max_score_snapshot ?? c.max_score)}
                            step="any"
                            disabled={
                              busy || !writable("assessment_results", result)
                            }
                            onBlur={(e) => {
                              if (
                                e.target.value !== "" &&
                                Number(e.target.value) !== r?.score
                              )
                                void run(() => rubric(c, e.target.value));
                            }}
                          />
                        </label>
                      );
                    })
                  : visibleQuestions.map((q) => {
                      const r = latest(
                        "question_results",
                        `q:${result?.id}:${q.id}`,
                        (x) =>
                          x.assessment_result_id === result?.id &&
                          x.question_id === q.id,
                      );
                      return (
                        <div className="correction-row" key={q.id}>
                          <strong>{text(q, "label")}</strong>
                          {parent.correction_mode === "quick" ? (
                            <div className="quick-buttons">
                              {["good", "partial", "poor", "unanswered"].map(
                                (v) => (
                                  <button
                                    className={
                                      "button " +
                                      (r?.quick_result === v ? "selected" : "")
                                    }
                                    key={v}
                                    aria-pressed={r?.quick_result === v}
                                    disabled={
                                      busy ||
                                      !writable("assessment_results", result)
                                    }
                                    onClick={() =>
                                      void run(() => correct(q, v))
                                    }
                                  >
                                    {compact && v === "partial"
                                      ? "Così così"
                                      : compact && v === "unanswered"
                                        ? "Non risposto"
                                        : tr(v)}
                                  </button>
                                ),
                              )}
                            </div>
                          ) : (
                            <label>
                              Punti /{" "}
                              {text(
                                r ?? q,
                                r ? "max_score_snapshot" : "max_score",
                              )}
                              <input
                                key={r?.version ?? q.id}
                                type="number"
                                inputMode="decimal"
                                min="0"
                                max={Number(
                                  r?.max_score_snapshot ?? q.max_score,
                                )}
                                step="any"
                                defaultValue={text(r, "score")}
                                disabled={
                                  busy ||
                                  !writable("assessment_results", result)
                                }
                                onBlur={(e) => {
                                  if (
                                    e.target.value !== "" &&
                                    Number(e.target.value) !== r?.score
                                  )
                                    void run(() => correct(q, e.target.value));
                                }}
                              />
                            </label>
                          )}
                          {r && (
                            <div className="quick-buttons">
                              <button
                                className="button"
                                onClick={() =>
                                  editor("question_errors", {
                                    question_result_id: r.id,
                                  })
                                }
                              >
                                Associa errore
                              </button>
                              <button
                                className="button"
                                onClick={() =>
                                  editor("question_results", {}, r)
                                }
                              >
                                Commento
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                {result && (
                  <>
                    <button
                      className="button"
                      onClick={() => editor("assessment_results", {}, result)}
                    >
                      Commento finale
                    </button>
                    <GradeEditor
                      disabled={busy}
                      key={result.id}
                      source={result}
                      origin="assessment"
                      enrollment={enrollment.id}
                      assignment={text(parent, "teaching_assignment_id")}
                    />
                  </>
                )}
              </>
            )}
          </section>
        </>
      )}
      {edit && (
        <Modal
          title={catalog[edit.table]!.title}
          close={() => setEdit(undefined)}
        >
          <EntityForm
            key={edit.row?.id ?? edit.table}
            {...edit}
            done={() => setEdit(undefined)}
            onSaved={(r) => {
              if (edit.table === "observations" && r.mode === "GRADED")
                setGraded(r);
            }}
          />
        </Modal>
      )}
      {graded && (
        <Modal title="Valutazione" close={() => setGraded(undefined)}>
          <GradeEditor
            source={graded}
            origin={kind === "assignments" ? "homework" : "observation"}
            enrollment={text(graded, "enrollment_id")}
            assignment={text(parent, "teaching_assignment_id")}
          />
        </Modal>
      )}
    </>
  );
}
