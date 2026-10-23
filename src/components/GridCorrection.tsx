import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useCapabilities } from "../hooks/capabilities";
import { assessmentProgress } from "../domain/teaching";
import { useData } from "../state/data";
import { usePermissions } from "../hooks/permissions";
import { useUnsavedChanges, allowContextChange } from "../hooks/unsaved";
import {
  gridSummary,
  units,
  points,
  sumPoints,
  provisionalGrade,
  type Grid,
  type Exercise,
} from "../domain/grids";
import { orderedEnrollments, type RegisterOrder } from "../domain/register";
import { derivePatch, label } from "../domain/catalog";
import { text, type Row, type Patch } from "../types/model";
import { friendlyError } from "../domain/friendlyErrors";
import { PageTitle, ErrorBox } from "./ui";
import { GradeEditor } from "./GradeEditor";
import { gridReport } from "../services/gridReports";
import { exportRows } from "../services/export";
export function GridCorrection({ assessment }: { assessment: Row }) {
  const { data, save, online } = useData(),
    { writable } = usePermissions(),
    grid = assessment.grid_snapshot as Grid;
  const caps = useCapabilities();
  const [selected, select] = useState(""),
    [index, setIndex] = useState(0),
    [order, setOrder] = useState<RegisterOrder>("register"),
    [search, setSearch] = useState(""),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(""),
    [local, setLocal] = useState<Record<string, Row>>({}),
    [dirty, setDirty] = useState(false);
  const live = useRef<Record<string, Row>>({});
  const drafts = useRef(new Set<string>());
  useUnsavedChanges(dirty);
  const roster = orderedEnrollments(
    (data.enrollments ?? []).filter(
      (e) =>
        e.class_id === assessment.class_id &&
        text(e, "starts_on") <= text(assessment, "assessed_on") &&
        (!e.ends_on || text(e, "ends_on") >= text(assessment, "assessed_on")),
    ),
    data,
    order,
  ).filter((e) =>
    label("enrollments", e, data)
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  const enrollment = roster.find((e) => e.id === selected) ?? roster[0];
  const results = [
    ...(data.assessment_results ?? []),
    ...Object.values(local).filter(
      (r) => r.assessment_id === assessment.id && r.enrollment_id,
    ),
  ];
  const result = results
    .filter(
      (r) =>
        r.enrollment_id === enrollment?.id && r.assessment_id === assessment.id,
    )
    .sort((a, b) => Number(b.version) - Number(a.version))[0];
  const merged = new Map((data.question_results ?? []).map((r) => [r.id, r]));
  for (const r of Object.values(local))
    if (
      r.question_id &&
      Number(r.version) >= Number(merged.get(r.id)?.version ?? 0)
    )
      merged.set(r.id, r);
  const questions = [...merged.values()],
    summary = gridSummary(grid, questions, result?.id),
    exercises = summary.sections.flatMap((s) =>
      s.exercises.map((e) => ({ ...e, section: s.label })),
    ),
    position = Math.min(index, exercises.length - 1),
    visible = exercises.slice(position, position + 1);
  const grade = data.grade_entries?.find(
      (r) => r.assessment_result_id === result?.id,
    ),
    rule = grid.rule as Row;
  const keep = (row: Row) => {
    live.current[row.id] = row;
    setLocal((v) => ({ ...v, [row.id]: row }));
    return row;
  };
  async function store(exercise: Exercise, patch: Patch) {
    if (!enrollment || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      let parent =
        Object.values(live.current).find(
          (r) =>
            r.assessment_id === assessment.id &&
            r.enrollment_id === enrollment.id,
        ) ?? result;
      if (!parent)
        parent = keep(
          await save(
            "assessment_results",
            derivePatch(
              "assessment_results",
              {
                assessment_id: assessment.id,
                enrollment_id: enrollment.id,
                visibility: text(assessment, "visibility") || "workspace",
              },
              data,
            ),
          ),
        );
      const previous =
        Object.values(live.current).find(
          (r) =>
            r.assessment_result_id === parent.id &&
            r.question_id === exercise.id,
        ) ??
        questions.find(
          (r) =>
            r.assessment_result_id === parent.id &&
            r.question_id === exercise.id,
        );
      keep(
        await save(
          "question_results",
          previous
            ? patch
            : {
                ...patch,
                assessment_result_id: parent.id,
                assessment_id: assessment.id,
                question_id: exercise.id,
                max_score_snapshot: Number(exercise.maximum),
                visibility: text(assessment, "visibility") || "workspace",
              },
          previous,
        ),
      );
      drafts.current.delete(exercise.id);
      setDirty(drafts.current.size > 0);
      setFeedback(
        online
          ? "Correzione salvata."
          : "Bozza salvata sul dispositivo: sincronizzazione in attesa.",
      );
    } catch (e) {
      setError(friendlyError(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }
  function choose(id: string) {
    if (busy || !allowContextChange()) return;
    select(id);
    setIndex(0);
    setDirty(false);
    drafts.current.clear();
    setFeedback("");
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        !event.altKey ||
        busy ||
        !enrollment ||
        !["ArrowLeft", "ArrowRight"].includes(event.key)
      )
        return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      if (event.shiftKey) {
        const target = roster[roster.indexOf(enrollment) + direction];
        if (target) choose(target.id);
      } else if (allowContextChange()) {
        setIndex(
          Math.max(0, Math.min(exercises.length - 1, position + direction)),
        );
        drafts.current.clear();
        setDirty(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [
    busy,
    dirty,
    position,
    enrollment?.id,
    roster.map((e) => e.id).join(","),
  ]);
  async function attendance() {
    if (!enrollment) return;
    setBusy(true);
    setError(undefined);
    try {
      const patch = {
        attendance: result?.attendance === "absent" ? "present" : "absent",
      };
      const row = await save(
        "assessment_results",
        result
          ? patch
          : derivePatch(
              "assessment_results",
              {
                ...patch,
                assessment_id: assessment.id,
                enrollment_id: enrollment.id,
                visibility: text(assessment, "visibility") || "workspace",
              },
              data,
            ),
        result,
      );
      keep(row);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const reports = roster.map((e) => {
    const r = results.find(
      (r) => r.assessment_id === assessment.id && r.enrollment_id === e.id,
    );
    return {
      name: label("enrollments", e, data),
      result: r,
      questions,
      grade: data.grade_entries?.find((g) => g.assessment_result_id === r?.id),
    };
  });
  let proposal = "—";
  try {
    proposal = provisionalGrade(summary.obtained, grid.maximum, rule);
  } catch {
    /* Missing configuration shown by validation. */
  }
  return (
    <>
      <PageTitle
        title={text(assessment, "title")}
        subtitle="Correzione universale · struttura e conversione congelate nella prova"
      />
      <ErrorBox error={error} />
      <p>
        Da correggere:{" "}
        {
          roster.filter((e) =>
            ["uncorrected", "incomplete"].includes(
              assessmentProgress(assessment, e, {
                ...data,
                assessment_results: results,
                question_results: questions,
              }),
            ),
          ).length
        }{" "}
        · Esercizi incompleti: {summary.expected - summary.completed}. Uno score
        mancante non è zero.
      </p>
      <p>
        Scorciatoie: Alt + frecce per esercizio, Alt + Maiusc + frecce per
        studente, Ctrl + Invio nel campo per salvare. Le bozze valide si salvano
        automaticamente.
      </p>
      <Link className="button" to={"/verifiche/" + assessment.id + "/analisi"}>
        Analisi della verifica
      </Link>
      {caps.data?.recovery && enrollment && (
        <button
          className="button"
          disabled={busy || dirty || !writable("assessment_results", result)}
          onClick={() => void attendance()}
        >
          {result?.attendance === "absent" ? "Segna presente" : "Segna assente"}
        </button>
      )}
      {result?.attendance === "absent" && (
        <p role="status">
          Studente assente: correzione e conferma del voto bloccate.
        </p>
      )}
      <div className="card form-grid">
        <label>
          Cerca studente
          <input
            value={search}
            onChange={(e) => {
              if (allowContextChange()) {
                setSearch(e.target.value);
                drafts.current.clear();
                setDirty(false);
              }
            }}
          />
        </label>
        <label>
          Ordina elenco
          <select
            aria-label="Ordina elenco"
            value={order}
            onChange={(e) => {
              if (allowContextChange()) {
                setOrder(e.target.value as RegisterOrder);
                drafts.current.clear();
                setDirty(false);
              }
            }}
          >
            <option value="register">Numero di registro</option>
            <option value="surname">Cognome</option>
            <option value="name">Nome</option>
          </select>
        </label>
        <label>
          Studente
          <select
            aria-label="Studente"
            disabled={busy}
            value={enrollment?.id ?? ""}
            onChange={(e) => choose(e.target.value)}
          >
            {roster.map((e) => (
              <option key={e.id} value={e.id}>
                {label("enrollments", e, data)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!enrollment ? (
        <p>Nessuno studente iscritto alla data della verifica.</p>
      ) : (
        <>
          <div className="form-actions">
            <button
              className="button"
              disabled={busy || roster.indexOf(enrollment) <= 0}
              onClick={() => choose(roster[roster.indexOf(enrollment) - 1].id)}
            >
              Studente precedente
            </button>
            <button
              className="button"
              disabled={busy || roster.indexOf(enrollment) >= roster.length - 1}
              onClick={() => choose(roster[roster.indexOf(enrollment) + 1].id)}
            >
              Studente successivo
            </button>
          </div>
          <p role="status">
            {feedback} · Esercizi completi {summary.completed}/
            {summary.expected} · Punti {summary.obtained}/{summary.maximum} ·
            Voto provvisorio {proposal}
          </p>
          {grade?.status === "confirmed" && (
            <p className="notice">
              Il voto confermato resta invariato. Dopo nuove correzioni,
              verifica il riepilogo ed esegui una rettifica motivata.
            </p>
          )}
          {exercises.length > 0 && (
            <div className="form-actions">
              <button
                className="button"
                disabled={busy || position <= 0}
                onClick={() => {
                  if (allowContextChange()) {
                    setIndex(position - 1);
                    drafts.current.clear();
                    setDirty(false);
                  }
                }}
              >
                Esercizio precedente
              </button>
              <span>
                {position + 1}/{exercises.length}
              </span>
              <button
                className="button"
                disabled={busy || position >= exercises.length - 1}
                onClick={() => {
                  if (allowContextChange()) {
                    setIndex(position + 1);
                    drafts.current.clear();
                    setDirty(false);
                  }
                }}
              >
                Esercizio successivo
              </button>
            </div>
          )}
          {visible.map((e) => (
            <ExerciseCorrection
              key={`${enrollment.id}:${e.id}:${e.row?.version ?? 0}`}
              exercise={e}
              section={e.section}
              row={e.row}
              disabled={
                busy ||
                result?.attendance === "absent" ||
                !writable("assessment_results", result)
              }
              precision={grid.precision}
              changed={() => {
                drafts.current.add(e.id);
                setDirty(true);
              }}
              store={(p) => store(e, p)}
            />
          ))}
          {result && (
            <GradeEditor
              key={result.id}
              source={result}
              origin="assessment"
              enrollment={enrollment.id}
              assignment={text(assessment, "teaching_assignment_id")}
              disabled={
                dirty ||
                busy ||
                result.attendance === "absent" ||
                !summary.complete ||
                !online
              }
              requireReview
              fixedRule
            />
          )}
        </>
      )}
      <section className="card">
        <h2>Esporta la griglia</h2>
        <div className="form-actions">
          {(["blank", "student", "class", "competencies"] as const).map(
            (kind, i) => (
              <button
                key={kind}
                className="button"
                onClick={() =>
                  void gridReport(
                    kind,
                    grid,
                    kind === "student"
                      ? reports.filter((r) => r.result?.id === result?.id)
                      : reports,
                  ).catch(setError)
                }
              >
                {
                  ["PDF vuoto", "PDF studente", "PDF classe", "PDF competenze"][
                    i
                  ]
                }
              </button>
            ),
          )}
          {(["csv", "xlsx"] as const).map((f) => (
            <button
              key={f}
              className="button"
              onClick={() =>
                void exportRows(
                  f,
                  text(assessment, "title"),
                  reports.map((s) => {
                    const a = gridSummary(grid, s.questions, s.result?.id);
                    return {
                      Studente: s.name,
                      Punti: a.obtained,
                      Massimo: a.maximum,
                      Voto: (s.grade?.confirmed_value as number) ?? null,
                    };
                  }),
                ).catch(setError)
              }
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        <p>
          Il punteggio rapido non produce evidenze analitiche di competenza. I
          descrittori originali dei modelli matematici devono essere forniti e
          completati.
        </p>
      </section>
    </>
  );
}
function ExerciseCorrection({
  exercise: e,
  section,
  row,
  disabled,
  precision,
  changed,
  store,
}: {
  exercise: Exercise;
  section: string;
  row?: Row;
  disabled: boolean;
  precision: number;
  changed: () => void;
  store: (p: Patch) => Promise<void>;
}) {
  const [mode, setMode] = useState(
      row?.criterion_scores ? "analytic" : "quick",
    ),
    [quick, setQuick] = useState(text(row, "score")),
    [detail, setDetail] = useState<Record<string, string>>(
      Object.fromEntries(
        Object.entries(row?.criterion_scores ?? {}).map(([k, v]) => [
          k,
          String(v),
        ]),
      ),
    ),
    [error, setError] = useState("");
  const [edited, setEdited] = useState(false);
  useEffect(() => {
    if (
      !edited ||
      disabled ||
      (mode === "quick" && !quick.trim()) ||
      (mode === "analytic" && !Object.values(detail).some((v) => v.trim()))
    )
      return;
    const timer = window.setTimeout(() => void submit(), 900);
    return () => window.clearTimeout(timer);
  }, [edited, disabled, mode, quick, detail]);
  async function submit() {
    try {
      let patch: Patch;
      if (mode === "quick") {
        const n = units(quick);
        if (n > units(e.maximum) || n % 10 ** (3 - precision))
          throw Error("Punteggio oltre il massimo o precisione non valida.");
        patch = { score: Number(points(n)), criterion_scores: null };
      } else {
        const scores: Record<string, number> = {};
        for (const c of e.criteria) {
          if (detail[c.id] == null || detail[c.id] === "") continue;
          const n = units(detail[c.id]);
          if (n > units(c.maximum) || n % 10 ** (3 - precision))
            throw Error(
              "Punteggio analitico oltre il massimo o precisione non valida.",
            );
          scores[c.id] = Number(points(n));
        }
        if (!Object.keys(scores).length)
          throw Error(
            "Inserisci almeno un punteggio esplicito: una correzione mancante non vale zero.",
          );
        patch = {
          score: Number(sumPoints(Object.values(scores))),
          criterion_scores: scores,
        };
      }
      setError("");
      await store(patch);
      setEdited(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section
      className="card"
      onChangeCapture={() => {
        changed();
        setEdited(true);
      }}
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          void submit();
        }
      }}
    >
      <p className="muted">{section}</p>
      <h2>
        {e.label} · massimo {e.maximum}
      </h2>
      <button
        className="button"
        disabled={disabled}
        onClick={() => {
          setMode("quick");
          setQuick(e.maximum);
          setEdited(true);
          changed();
        }}
      >
        Assegna massimo esercizio
      </button>
      <p role="status">
        {edited
          ? "Bozza modificata: salvataggio automatico dei valori validi…"
          : row
            ? "Bozza salvata"
            : "Non corretto: punteggio non assegnato"}
      </p>
      <label>
        Modalità punteggio
        <select
          aria-label="Modalità punteggio"
          value={mode}
          disabled={disabled}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="quick">Rapido: totale esercizio</option>
          <option value="analytic">Analitico: sottocriteri</option>
        </select>
      </label>
      {mode === "quick" ? (
        <label>
          Punti esercizio
          <input
            type="text"
            inputMode="decimal"
            value={quick}
            disabled={disabled}
            onChange={(e) => setQuick(e.target.value)}
          />
        </label>
      ) : (
        <div className="form-grid">
          {e.criteria.map((c) => (
            <label key={c.id}>
              {c.label} / {c.maximum}
              <input
                type="text"
                inputMode="decimal"
                value={detail[c.id] ?? ""}
                disabled={disabled}
                onChange={(e) =>
                  setDetail((v) => ({ ...v, [c.id]: e.target.value }))
                }
              />
              <small>
                {c.description || "Descrittore da completare"}
                {c.levels
                  .map(
                    (l) =>
                      ` · ${l.label} ${l.from}–${l.to}: ${l.description || "da completare"}`,
                  )
                  .join("")}
              </small>
            </label>
          ))}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <button
        className="button primary"
        disabled={disabled}
        onClick={() => void submit()}
      >
        Salva senza uscire
      </button>
    </section>
  );
}
