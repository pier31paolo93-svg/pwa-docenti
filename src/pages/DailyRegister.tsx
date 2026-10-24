import { useRef, useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { TimetableDay } from "../components/TimetableDay";
import { useTimetable } from "../hooks/timetable";
import { useAuth } from "../state/auth";
import { occurrences, type Occurrence } from "../domain/timetable";
import { useData, useRows } from "../state/data";
import { useCapabilities } from "../hooks/capabilities";
import { usePermissions } from "../hooks/permissions";
import { useUnsavedChanges, allowContextChange } from "../hooks/unsaved";
import { orderedEnrollments } from "../domain/register";
import { currentAssignments } from "../domain/context";
import { label, derivePatch } from "../domain/catalog";
import {
  text,
  today,
  type Row,
  type Patch,
  type TableName,
} from "../types/model";
import { PageTitle, ErrorBox, Modal } from "../components/ui";
import { EntityForm } from "../components/EntityForm";
import { GradeEditor } from "../components/GradeEditor";
export function DailyRegister() {
  const [params] = useSearchParams(),
    timetable = useTimetable(),
    auth = useAuth();
  const [scheduled, setScheduled] = useState<Occurrence>();
  const completion = useRows("v_homework_completion");
  const { data, filters, save, online, setFilters } = useData(),
    caps = useCapabilities(),
    { writable } = usePermissions();
  const [ta, setTa] = useState(params.get("assignment") ?? ""),
    [day, setDay] = useState(params.get("day") ?? today()),
    [lessonId, setLesson] = useState(""),
    [assignmentId, setAssignment] = useState(""),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(""),
    [edit, setEdit] = useState(false),
    [graded, setGraded] = useState<{ row: Row; enrollment: string }>(),
    [drafts, setDrafts] = useState<
      Record<string, { notes: string; participation: string }>
    >({}),
    [local, setLocal] = useState<Record<string, Row>>({});
  const live = useRef<Record<string, Row>>({});
  const scheduleInitialised = useRef(false);
  function chooseScheduled(o: Occurrence) {
    if (
      Object.keys(drafts).length &&
      !window.confirm("Abbandonare le annotazioni non salvate?")
    )
      return;
    const a = data.teaching_assignments?.find((a) => a.id === o.assignment);
    if (!a) return;
    const cls = data.classes?.find((c) => c.id === a.class_id),
      cs = data.class_subjects?.find((c) => c.id === a.class_subject_id);
    setFilters({
      classId: String(a.class_id),
      subject: String(cs?.subject_id ?? ""),
      school: String(cls?.school_id ?? ""),
      year: String(cls?.school_year_id ?? ""),
    });
    setTa(o.assignment);
    setDay(o.day);
    setLesson(o.lesson?.id ?? "");
    setScheduled(o);
    setDrafts({});
  }
  useEffect(() => {
    if (
      scheduleInitialised.current ||
      !timetable.data ||
      !data.teaching_assignments?.length
    )
      return;
    const available = occurrences(
      timetable.timetable,
      data,
      day,
      auth.session!.user.id,
      filters.year,
      filters.school,
    );
    const chosen = params.get("occurrence")
      ? available.find((o) => o.id === params.get("occurrence"))
      : !ta && available.length === 1
        ? available[0]
        : undefined;
    if (chosen) {
      chooseScheduled(chosen);
      scheduleInitialised.current = true;
    }
  }, [timetable.data, data.teaching_assignments, day]);
  useUnsavedChanges(Object.keys(drafts).length > 0);
  const tas = currentAssignments(data, filters),
    selected = tas.find((t) => t.id === ta) ?? tas[0],
    lessons = (data.lessons ?? []).filter(
      (l) =>
        l.teaching_assignment_id === selected?.id &&
        new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(
          new Date(text(l, "starts_at")),
        ) === day,
    ),
    lesson = lessons.find((l) => l.id === lessonId) ?? lessons[0];
  const assignments = (data.assignments ?? []).filter(
      (a) =>
        a.teaching_assignment_id === selected?.id &&
        text(a, "assigned_on") <= day,
    ),
    assignment =
      assignments.find((a) => a.id === assignmentId) ??
      assignments
        .filter((a) => text(a, "due_on") >= day)
        .sort((a, b) =>
          text(a, "due_on").localeCompare(text(b, "due_on")),
        )[0] ??
      assignments[0];
  const roster = orderedEnrollments(
    (data.enrollments ?? []).filter(
      (e) =>
        e.class_id === selected?.class_id &&
        text(e, "starts_on") <= day &&
        (!e.ends_on || text(e, "ends_on") >= day),
    ),
    data,
  );
  function latest(table: TableName, predicate: (r: Row) => boolean) {
    return [...(data[table] ?? []), ...Object.values(local)]
      .filter(predicate)
      .sort((a, b) => Number(b.version) - Number(a.version))[0];
  }
  async function persist(table: TableName, patch: Patch, row?: Row) {
    const fresh = row ? (live.current[row.id] ?? row) : undefined;
    const saved = await save(table, patch, fresh);
    live.current[saved.id] = saved;
    setLocal((v) => ({ ...v, [saved.id]: saved }));
    return saved;
  }
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await fn();
      setFeedback(
        online
          ? "Salvato."
          : "Salvato sul dispositivo; sincronizzazione in attesa.",
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function homework(e: Row, status: string) {
    if (!assignment)
      throw Error("Seleziona una consegna reale da controllare.");
    const current = latest(
      "homework_checks",
      (r) => r.assignment_id === assignment.id && r.enrollment_id === e.id,
    );
    if (current?.excused)
      throw Error(
        "Compito giustificato: gestisci esplicitamente la giustificazione nel modulo Compiti.",
      );
    await persist(
      "homework_checks",
      current
        ? { daily_status: status, checked_on: day }
        : {
            assignment_id: assignment.id,
            enrollment_id: e.id,
            class_id: e.class_id as string,
            checked_on: day,
            daily_status: status,
            visibility: "workspace",
          },
      current,
    );
  }
  async function observation(e: Row, grade = false) {
    if (!lesson || !selected)
      throw Error("Seleziona o crea la lezione prima di annotare.");
    const type =
      data.observation_types?.find((t) => t.disciplinary_default) ??
      data.observation_types?.[0];
    if (!type) throw Error("Configura un tipo di osservazione.");
    const current = latest(
        "observations",
        (r) => r.daily_lesson_id === lesson.id && r.enrollment_id === e.id,
      ),
      draft = drafts[e.id] ?? {
        notes: text(current, "notes"),
        participation: text(current, "participation"),
      };
    const patch = {
      notes: draft.notes,
      participation: draft.participation,
      ...(grade ? { mode: "GRADED" } : {}),
    };
    const saved = await persist(
      "observations",
      current
        ? patch
        : derivePatch(
            "observations",
            {
              ...patch,
              teaching_assignment_id: selected.id,
              enrollment_id: e.id,
              observation_type_id: type.id,
              observed_on: day,
              daily_lesson_id: lesson.id,
              mode: grade ? "GRADED" : "DESCRIPTIVE",
              visibility: "workspace",
            },
            data,
          ),
      current,
    );
    setDrafts((v) => {
      const next = { ...v };
      delete next[e.id];
      return next;
    });
    if (grade) setGraded({ row: saved, enrollment: e.id });
  }
  return (
    <>
      <PageTitle
        title="Registro rapido"
        subtitle="Classe, materia e data: compiti, partecipazione e osservazioni nella stessa schermata."
      />
      <ErrorBox error={error} />
      <TimetableDay day={day} onChoose={chooseScheduled} />
      {scheduled &&
        scheduled.day === day &&
        scheduled.assignment === selected?.id &&
        !scheduled.cancelled && (
          <section className="card">
            <p>
              Slot selezionato: {scheduled.start}–{scheduled.end}. Classe,
              materia e orario restano modificabili dal registro.
            </p>
            <button
              className="button"
              disabled={!online || busy}
              onClick={() =>
                void run(async () => {
                  const id = await timetable.rpc<string>(
                    "register_timetable_lesson",
                    { p_occurrence: scheduled.id, p_day: day },
                  );
                  setLesson(id);
                })
              }
            >
              Apri o registra la lezione selezionata
            </button>
          </section>
        )}
      {!caps.data?.dailyRegister ? (
        <p role="alert">
          Registro rapido disponibile dopo le migrazioni V1.3 24–25. I registri
          precedenti restano disponibili.
        </p>
      ) : (
        <>
          <div className="card form-grid">
            <label>
              Classe e materia
              <select
                aria-label="Classe e materia"
                value={selected?.id ?? ""}
                onChange={(e) => {
                  if (allowContextChange()) {
                    setTa(e.target.value);
                    setDrafts({});
                    setLesson("");
                    setAssignment("");
                  }
                }}
              >
                {tas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {label("teaching_assignments", t, data)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Data lezione
              <input
                type="date"
                value={day}
                onChange={(e) => {
                  if (allowContextChange()) {
                    setDay(e.target.value);
                    setDrafts({});
                  }
                }}
              />
            </label>
            <label>
              Lezione
              <select
                aria-label="Lezione del registro rapido"
                value={lesson?.id ?? ""}
                onChange={(e) => {
                  if (allowContextChange()) {
                    setLesson(e.target.value);
                    setDrafts({});
                  }
                }}
              >
                <option value="">Nessuna lezione selezionata</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {text(l, "title")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Compito da controllare
              <select
                aria-label="Compito da controllare"
                value={assignment?.id ?? ""}
                onChange={(e) => setAssignment(e.target.value)}
              >
                <option value="">Nessun compito</option>
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {text(a, "title")} · {text(a, "due_on")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button
              className="button"
              disabled={!selected || busy || !writable("lessons")}
              onClick={() => setEdit(true)}
            >
              Crea lezione
            </button>
            <Link className="button" to="/compiti">
              Gestisci compiti
            </Link>
            <button
              className="button"
              disabled={!assignment || busy || !writable("homework_checks")}
              onClick={() => {
                if (
                  window.confirm(
                    `Segnare fatti i compiti dei ${roster.length} studenti visibili? Potrai correggere le eccezioni.`,
                  )
                )
                  void run(async () => {
                    for (const e of roster) {
                      if (
                        latest(
                          "homework_checks",
                          (r) =>
                            r.assignment_id === assignment?.id &&
                            r.enrollment_id === e.id,
                        )?.excused
                      )
                        continue;
                      await homework(e, "complete");
                    }
                  });
              }}
            >
              Tutti compiti fatti
            </button>
            <small>Le giustificazioni esistenti restano invariate.</small>
          </div>
          <p role="status">{feedback}</p>
          <div className="daily-roster">
            {roster.map((e) => {
              const check = assignment
                  ? latest(
                      "homework_checks",
                      (r) =>
                        r.assignment_id === assignment.id &&
                        r.enrollment_id === e.id,
                    )
                  : undefined,
                obs = lesson
                  ? latest(
                      "observations",
                      (r) =>
                        r.daily_lesson_id === lesson.id &&
                        r.enrollment_id === e.id,
                    )
                  : undefined;
              const draft = drafts[e.id] ?? {
                notes: text(obs, "notes"),
                participation: text(obs, "participation"),
              };
              const completionState = check?.excused
                ? "excused"
                : (check?.daily_status ??
                  (text(
                    completion.data?.find((c) => c.id === check?.id),
                    "completion_status",
                  ) ||
                    "unchecked"));
              return (
                <article className="card" key={e.id}>
                  <h2>{label("enrollments", e, data)}</h2>
                  <div
                    className="form-actions"
                    role="group"
                    aria-label={"Compiti " + label("enrollments", e, data)}
                  >
                    {[
                      ["complete", "Fatti"],
                      ["partial", "Parziali"],
                      ["not_done", "Non fatti"],
                      ["unchecked", "Non controllato"],
                    ].map(([status, name]) => (
                      <button
                        className={
                          "button " +
                          (completionState === status ? "primary" : "")
                        }
                        aria-pressed={completionState === status}
                        key={status}
                        disabled={
                          busy ||
                          !assignment ||
                          !writable("homework_checks", check)
                        }
                        onClick={() => void run(() => homework(e, status))}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  <div className="form-grid">
                    <label>
                      Partecipazione
                      <input
                        disabled={
                          busy || !lesson || !writable("observations", obs)
                        }
                        value={draft.participation}
                        onChange={(v) =>
                          setDrafts((d) => ({
                            ...d,
                            [e.id]: { ...draft, participation: v.target.value },
                          }))
                        }
                      />
                    </label>
                    <label>
                      Osservazione veloce
                      <textarea
                        disabled={
                          busy || !lesson || !writable("observations", obs)
                        }
                        value={draft.notes}
                        onChange={(v) =>
                          setDrafts((d) => ({
                            ...d,
                            [e.id]: { ...draft, notes: v.target.value },
                          }))
                        }
                      />
                    </label>
                  </div>
                  <div className="form-actions">
                    <button
                      className="button"
                      disabled={
                        busy || !lesson || !writable("observations", obs)
                      }
                      onClick={() => void run(() => observation(e))}
                    >
                      Salva annotazione
                    </button>
                    <button
                      className="button"
                      disabled={
                        busy || !lesson || !writable("observations", obs)
                      }
                      onClick={() => void run(() => observation(e, true))}
                    >
                      Valutazione esplicita
                    </button>
                  </div>
                  <small role="status">
                    {drafts[e.id]
                      ? "Annotazione non salvata"
                      : obs || check
                        ? online
                          ? "Dati salvati"
                          : "Dati locali: controlla la sincronizzazione"
                        : "Non ancora registrato"}
                  </small>
                </article>
              );
            })}
          </div>
        </>
      )}
      {edit && (
        <Modal title="Crea lezione" close={() => setEdit(false)}>
          <EntityForm
            table="lessons"
            initial={{
              teaching_assignment_id: selected?.id ?? "",
              title: "",
              starts_at:
                day +
                "T" +
                (scheduled?.day === day && scheduled.assignment === selected?.id
                  ? scheduled.start
                  : "09:00"),
              ends_at:
                day +
                "T" +
                (scheduled?.day === day && scheduled.assignment === selected?.id
                  ? scheduled.end
                  : "10:00"),
            }}
            done={() => setEdit(false)}
          />
        </Modal>
      )}
      {graded && selected && (
        <Modal
          title="Valutazione del registro rapido"
          close={() => setGraded(undefined)}
        >
          <GradeEditor
            source={graded.row}
            origin="observation"
            enrollment={graded.enrollment}
            assignment={selected.id}
            requireReview
          />
        </Modal>
      )}
    </>
  );
}
