import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useData } from "../state/data";
import { useAuth } from "../state/auth";
import { usePermissions } from "../hooks/permissions";
import { useCapabilities } from "../hooks/capabilities";
import { useTeachers } from "../hooks/teachers";
import { useUnsavedChanges } from "../hooks/unsaved";
import {
  orderedEnrollments,
  firstRegisterNumber,
  nextClassName,
} from "../domain/register";
import { label, tr } from "../domain/catalog";
import { text, type Row } from "../types/model";
import { PageTitle, ErrorBox } from "../components/ui";
import { v12Rpc } from "../services/v12";
import { supabase } from "../services/supabase";
type Decision = {
  outcome: string;
  destination_id: string;
  register_number: string;
};
type Destination = { id: string; name: string; existing: boolean };
const outcomes = [
  "pending",
  "promoted",
  "repeating",
  "transferred",
  "withdrawn",
  "graduated",
];
export function YearTransition() {
  const { data, online, setFilters } = useData(),
    auth = useAuth(),
    { admin } = usePermissions(),
    caps = useCapabilities(),
    teachers = useTeachers(admin),
    qc = useQueryClient();
  const [source, setSource] = useState(""),
    [school, setSchool] = useState(""),
    [target, setTarget] = useState("new"),
    [sourceClasses, setSourceClasses] = useState<string[]>([]);
  const [year, setYear] = useState({
    id: crypto.randomUUID(),
    label: "",
    starts_on: "",
    ends_on: "",
  });
  const [destinations, setDestinations] = useState<Destination[]>([]),
    [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [step, setStep] = useState(0),
    [search, setSearch] = useState(""),
    [bulk, setBulk] = useState("pending"),
    [copySubjects, setCopySubjects] = useState(false),
    [confirmedTeachers, setConfirmedTeachers] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, unknown>>(),
    [approved, setApproved] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [result, setResult] = useState<{
      operation: string;
      new_enrollments: number;
      target_year_id: string;
    }>();
  const operation = useRef(crypto.randomUUID());
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty && !result);
  const sy = data.school_years?.find((y) => y.id === source);
  const classes = (data.classes ?? []).filter(
    (c) =>
      c.school_year_id === source && c.school_id === school && !c.deleted_at,
  );
  const roster = useMemo(
    () =>
      orderedEnrollments(
        (data.enrollments ?? []).filter(
          (e) => sourceClasses.includes(String(e.class_id)) && !e.deleted_at,
        ),
        data,
      ),
    [data, sourceClasses],
  );
  const active = roster.filter((e) => !e.ends_on),
    visible = active.filter((e) =>
      `${label("enrollments", e, data)} ${text(
        data.students?.find((s) => s.id === e.student_id),
        "external_code",
      )}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
    );
  const history = useQuery({
    queryKey: [
      "year-transition-history",
      auth.session?.user.id,
      auth.workspace,
    ],
    enabled: admin && online && !!caps.data?.yearTransition,
    queryFn: async () => {
      const r = await supabase
        .from("year_transitions")
        .select("id,created_at,status,result")
        .eq("workspace_id", auth.workspace)
        .order("created_at", { ascending: false });
      if (r.error) throw r.error;
      return r.data;
    },
  });
  useEffect(() => {
    const rows = (data.classes ?? []).filter(
      (c) =>
        c.school_year_id === source && c.school_id === school && !c.deleted_at,
    );
    setSourceClasses(rows.map((c) => c.id));
    setDecisions({});
    setPreview(undefined);
    setApproved(false);
    setStep(0);
    setResult(undefined);
    setConfirmedTeachers([]);
    if (sy) {
      const start = String(sy.ends_on).slice(0, 10),
        y = Number(start.slice(0, 4));
      setYear({
        id: crypto.randomUUID(),
        label: `${y}/${y + 1}`,
        starts_on: `${y}-09-01`,
        ends_on: `${y + 1}-08-31`,
      });
    }
  }, [source, school]);
  useEffect(() => {
    const proposals = new Map<string, Destination>();
    for (const c of classes)
      for (const name of [
        nextClassName(String(c.name)),
        nextClassName(String(c.name), true),
      ])
        if (name && !proposals.has(name)) {
          const existing = data.classes?.find(
            (x) =>
              x.school_year_id === target &&
              x.school_id === school &&
              x.name === name &&
              !x.deleted_at,
          );
          proposals.set(name, {
            id: existing?.id ?? crypto.randomUUID(),
            name,
            existing: !!existing,
          });
        }
    for (const c of data.classes ?? [])
      if (
        c.school_year_id === target &&
        c.school_id === school &&
        !c.deleted_at
      )
        proposals.set(String(c.name), {
          id: c.id,
          name: String(c.name),
          existing: true,
        });
    setDestinations([...proposals.values()]);
    setDecisions({});
    setPreview(undefined);
    setApproved(false);
  }, [source, school, target]);
  function change() {
    setDirty(true);
    setPreview(undefined);
    setApproved(false);
    operation.current = crypto.randomUUID();
  }
  function decision(e: Row): Decision {
    return (
      decisions[e.id] ?? {
        outcome: "pending",
        destination_id: "",
        register_number: "",
      }
    );
  }
  function available(destination: string, current: string, all = decisions) {
    const used = (data.enrollments ?? []).filter(
      (x) => x.class_id === destination && !x.deleted_at,
    );
    for (const [id, d] of Object.entries(all))
      if (
        id !== current &&
        d.destination_id === destination &&
        Number(d.register_number) > 0
      )
        used.push({
          id,
          class_id: destination,
          register_number: Number(d.register_number),
        });
    return String(firstRegisterNumber(used, destination));
  }
  function choose(e: Row, outcome: string) {
    change();
    setDecisions((old) => {
      const origin = data.classes?.find((c) => c.id === e.class_id);
      const name = nextClassName(
        String(origin?.name ?? ""),
        outcome === "repeating",
      );
      const destination = ["promoted", "repeating"].includes(outcome)
        ? (destinations.find((d) => d.name === name)?.id ?? "")
        : "";
      return {
        ...old,
        [e.id]: {
          outcome,
          destination_id: destination,
          register_number: destination ? available(destination, e.id, old) : "",
        },
      };
    });
  }
  function patch(e: Row, p: Partial<Decision>) {
    change();
    setDecisions((old) => ({ ...old, [e.id]: { ...decision(e), ...p } }));
  }
  function plan() {
    const entries = active.map((e) => ({
      enrollment_id: e.id,
      version: e.version,
      ...decision(e),
      register_number: decision(e).register_number
        ? Number(decision(e).register_number)
        : null,
      destination_id: decision(e).destination_id || null,
    }));
    const used = new Set(
      entries.flatMap((e) => (e.destination_id ? [e.destination_id] : [])),
    );
    const targetYear =
      target === "new" ? year : data.school_years?.find((y) => y.id === target);
    const copies: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    if (copySubjects)
      for (const e of active) {
        const dst = decision(e).destination_id;
        if (!dst) continue;
        for (const cs of data.class_subjects ?? []) {
          if (cs.class_id !== e.class_id || cs.deleted_at) continue;
          const key = cs.id + dst;
          if (seen.has(key)) continue;
          seen.add(key);
          copies.push({
            source_id: cs.id,
            destination_id: dst,
            teachers: (data.teaching_assignments ?? [])
              .filter(
                (a) =>
                  a.class_subject_id === cs.id &&
                  confirmedTeachers.includes(a.id) &&
                  !a.deleted_at,
              )
              .map((a) => ({ id: a.teacher_id, confirmed: true })),
          });
        }
      }
    return {
      source_year_id: source,
      school_id: school,
      target_year: targetYear,
      close_on: sy?.ends_on,
      source_classes: sourceClasses,
      classes: destinations
        .filter((d) => used.has(d.id))
        .map(({ id, name }) => ({ id, name })),
      students: entries,
      copies,
    };
  }
  async function review() {
    setError(undefined);
    setBusy(true);
    try {
      if (!source || !school || source === target)
        throw Error("Scegli scuola e due anni diversi.");
      const r = await v12Rpc<Record<string, unknown>>(
        "preview_year_transition",
        { p_workspace: auth.workspace, p_plan: plan() },
      );
      setPreview(r);
      setApproved(false);
      setStep(4);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    setError(undefined);
    setBusy(true);
    try {
      if (!preview || !approved)
        throw Error("Approva esplicitamente il riepilogo prima di applicare.");
      const r = await v12Rpc<{
        operation: string;
        new_enrollments: number;
        target_year_id: string;
      }>("apply_year_transition", {
        p_workspace: auth.workspace,
        p_operation: operation.current,
        p_plan: preview.plan,
      });
      setResult(r);
      setDirty(false);
      await qc.invalidateQueries({ queryKey: ["data"] });
      await history.refetch();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="v12-editor" onChangeCapture={() => setDirty(true)}>
      <PageTitle
        title="Passaggio anno"
        subtitle="Prepara classi e iscrizioni del nuovo anno senza cancellare lo storico. Solo online, con anteprima e conferma."
      />
      <ErrorBox error={error ?? history.error} />
      {!admin ? (
        <p role="alert">
          Il passaggio anno richiede un Owner o Admin del workspace.
        </p>
      ) : !caps.data?.yearTransition ? (
        <p role="alert">
          Il passaggio anno richiede le migrazioni V1.2 autorizzate nel cloud
          (21–22).
        </p>
      ) : (
        <>
          {!online && (
            <p role="status" className="banner">
              Offline: anteprima e applicazione sono bloccate. Nessuna
              operazione viene inserita nella coda offline.
            </p>
          )}
          {result ? (
            <section className="card" role="status">
              <h2>Passaggio completato</h2>
              <p>
                Nuove iscrizioni: {result.new_enrollments}. Gli esiti da
                definire restano aperti nell’anno precedente.
              </p>
              <p>Operazione: {result.operation}</p>
              <p>
                <Link
                  className="button"
                  to={`/orario?sourceYear=${source}&targetYear=${result.target_year_id}`}
                >
                  Copia la struttura dell’orario precedente (facoltativo)
                </Link>
              </p>
              <button
                className="button"
                onClick={() => {
                  setFilters({ year: result.target_year_id, classId: "" });
                  setResult(undefined);
                  setStep(0);
                }}
              >
                Lavora sul nuovo anno
              </button>
            </section>
          ) : (
            <>
              <nav className="wizard-steps" aria-label="Passaggi anno">
                {[
                  "Anni e classi",
                  "Esiti studenti",
                  "Nuove classi",
                  "Destinazioni e materie",
                  "Anteprima e conferma",
                ].map((s, i) => (
                  <span key={s} aria-current={step === i ? "step" : undefined}>
                    {i + 1}. {s}
                  </span>
                ))}
              </nav>
              {step === 0 && (
                <section className="card">
                  <h2>Anni e classi</h2>
                  <div className="form-grid">
                    <label>
                      Anno di origine
                      <select
                        aria-label="Anno di origine"
                        value={source}
                        onChange={(e) => {
                          change();
                          setSource(e.target.value);
                        }}
                      >
                        <option value="">Scegli…</option>
                        {data.school_years?.map((y) => (
                          <option key={y.id} value={y.id}>
                            {text(y, "label")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Scuola
                      <select
                        aria-label="Scuola"
                        value={school}
                        onChange={(e) => {
                          change();
                          setSchool(e.target.value);
                        }}
                      >
                        <option value="">Scegli…</option>
                        {data.schools?.map((s) => (
                          <option key={s.id} value={s.id}>
                            {text(s, "name")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Anno di destinazione
                      <select
                        aria-label="Anno di destinazione"
                        value={target}
                        onChange={(e) => {
                          change();
                          setTarget(e.target.value);
                        }}
                      >
                        <option value="new">
                          Crea un nuovo anno durante il passaggio
                        </option>
                        {data.school_years
                          ?.filter((y) => y.id !== source)
                          .map((y) => (
                            <option key={y.id} value={y.id}>
                              {text(y, "label")}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                  {target === "new" && (
                    <div className="form-grid">
                      <label>
                        Denominazione nuovo anno
                        <input
                          value={year.label}
                          onChange={(e) => {
                            change();
                            setYear({ ...year, label: e.target.value });
                          }}
                        />
                      </label>
                      <label>
                        Inizio nuovo anno
                        <input
                          type="date"
                          value={year.starts_on}
                          onChange={(e) => {
                            change();
                            setYear({ ...year, starts_on: e.target.value });
                          }}
                        />
                      </label>
                      <label>
                        Fine nuovo anno
                        <input
                          type="date"
                          value={year.ends_on}
                          onChange={(e) => {
                            change();
                            setYear({ ...year, ends_on: e.target.value });
                          }}
                        />
                      </label>
                    </div>
                  )}
                  <h3>Classi coinvolte</h3>
                  {classes.map((c) => (
                    <label className="inline-check" key={c.id}>
                      <input
                        type="checkbox"
                        checked={sourceClasses.includes(c.id)}
                        onChange={(e) => {
                          change();
                          setSourceClasses(
                            e.target.checked
                              ? [...sourceClasses, c.id]
                              : sourceClasses.filter((id) => id !== c.id),
                          );
                        }}
                      />
                      {text(c, "name")}
                    </label>
                  ))}
                  <p>
                    Le nuove righe vengono create soltanto dopo la conferma
                    finale.
                  </p>
                </section>
              )}
              {step === 1 && (
                <section>
                  <h2>Esiti degli studenti</h2>
                  <div className="section-toolbar">
                    <label>
                      Cerca studente
                      <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Numero, nome, cognome o codice"
                      />
                    </label>
                    <label>
                      Esito massivo
                      <select
                        aria-label="Esito massivo"
                        value={bulk}
                        onChange={(e) => setBulk(e.target.value)}
                      >
                        {outcomes.map((o) => (
                          <option key={o} value={o}>
                            {tr(o)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="button"
                      onClick={() => {
                        for (const e of visible) choose(e, bulk);
                      }}
                    >
                      Proponi esito ai {visible.length} visibili
                    </button>
                  </div>
                  {classes
                    .filter((c) => sourceClasses.includes(c.id))
                    .map((c) => (
                      <details open key={c.id}>
                        <summary>
                          {text(c, "name")} ·{" "}
                          {visible.filter((e) => e.class_id === c.id).length}{" "}
                          studenti
                        </summary>
                        {visible
                          .filter((e) => e.class_id === c.id)
                          .map((e) => (
                            <article className="card" key={e.id}>
                              <h3>{label("enrollments", e, data)}</h3>
                              <label>
                                Esito per{" "}
                                {label(
                                  "students",
                                  data.students?.find(
                                    (s) => s.id === e.student_id,
                                  ) ?? e,
                                  data,
                                )}
                                <select
                                  value={decision(e).outcome}
                                  onChange={(v) => choose(e, v.target.value)}
                                >
                                  {outcomes.map((o) => (
                                    <option key={o} value={o}>
                                      {tr(o)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </article>
                          ))}
                      </details>
                    ))}
                  <details>
                    <summary>
                      Iscrizioni già chiuse:{" "}
                      {roster.filter((e) => e.ends_on).length}
                    </summary>
                    {roster
                      .filter((e) => e.ends_on)
                      .map((e) => (
                        <p key={e.id}>
                          {label("enrollments", e, data)} ·{" "}
                          {tr(text(e, "outcome"))} · {text(e, "ends_on")}{" "}
                          (storico conservato)
                        </p>
                      ))}
                  </details>
                </section>
              )}
              {step === 2 && (
                <section>
                  <h2>Nuove classi</h2>
                  <p>
                    Modifica le proposte, riutilizza una classe o aggiungine una
                    per accorpamenti e suddivisioni. Dopo la quinta non viene
                    proposta una sesta.
                  </p>
                  <div className="v12-grid">
                    {destinations.map((d) => (
                      <label className="card" key={d.id}>
                        Classe {d.existing ? "già censita" : "da creare"}
                        <input
                          aria-label={"Classe destinazione " + d.name}
                          value={d.name}
                          disabled={d.existing}
                          onChange={(e) => {
                            change();
                            setDestinations(
                              destinations.map((x) =>
                                x.id === d.id
                                  ? { ...x, name: e.target.value }
                                  : x,
                              ),
                            );
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    className="button"
                    onClick={() => {
                      change();
                      setDestinations([
                        ...destinations,
                        {
                          id: crypto.randomUUID(),
                          name: "Nuova classe",
                          existing: false,
                        },
                      ]);
                    }}
                  >
                    Aggiungi classe di destinazione
                  </button>
                </section>
              )}
              {step === 3 && (
                <section>
                  <h2>Destinazioni e numeri</h2>
                  <p>
                    Controlla la classe e il numero di registro per ciascuno
                    studente prima dell’anteprima.
                  </p>
                  {active.map((e) => (
                    <article className="card" key={e.id}>
                      <h3>
                        {label("enrollments", e, data)} ·{" "}
                        {tr(decision(e).outcome)}
                      </h3>
                      {["promoted", "repeating"].includes(
                        decision(e).outcome,
                      ) ? (
                        <div className="form-grid">
                          <label>
                            Destinazione di{" "}
                            {label(
                              "students",
                              data.students?.find(
                                (s) => s.id === e.student_id,
                              ) ?? e,
                              data,
                            )}
                            <select
                              value={decision(e).destination_id}
                              onChange={(v) =>
                                patch(e, {
                                  destination_id: v.target.value,
                                  register_number: v.target.value
                                    ? available(v.target.value, e.id)
                                    : "",
                                })
                              }
                            >
                              <option value="">Scegli una destinazione</option>
                              {destinations.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Nuovo numero di registro
                            <input
                              type="number"
                              min="1"
                              step="1"
                              inputMode="numeric"
                              value={decision(e).register_number}
                              onChange={(v) =>
                                patch(e, { register_number: v.target.value })
                              }
                            />
                          </label>
                        </div>
                      ) : (
                        <p>
                          {decision(e).outcome === "pending"
                            ? "In sospeso: nessuna chiusura o destinazione fittizia."
                            : "Iscrizione precedente chiusa, nessuna nuova iscrizione."}
                        </p>
                      )}
                    </article>
                  ))}
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      checked={copySubjects}
                      onChange={(e) => {
                        change();
                        setCopySubjects(e.target.checked);
                        setConfirmedTeachers([]);
                      }}
                    />
                    Copia le associazioni classe/materia per le destinazioni
                    scelte
                  </label>
                  {copySubjects && (
                    <section className="card">
                      <h3>Docenti proposti: conferma individuale</h3>
                      <p>Nessun incarico viene copiato automaticamente.</p>
                      {(data.teaching_assignments ?? [])
                        .filter(
                          (a) =>
                            sourceClasses.includes(String(a.class_id)) &&
                            !a.deleted_at,
                        )
                        .map((a) => (
                          <label className="inline-check" key={a.id}>
                            <input
                              type="checkbox"
                              checked={confirmedTeachers.includes(a.id)}
                              disabled={
                                !teachers.data?.some(
                                  (t) => t.id === a.teacher_id,
                                )
                              }
                              onChange={(e) => {
                                change();
                                setConfirmedTeachers(
                                  e.target.checked
                                    ? [...confirmedTeachers, a.id]
                                    : confirmedTeachers.filter(
                                        (id) => id !== a.id,
                                      ),
                                );
                              }}
                            />
                            {label("teaching_assignments", a, data)} ·{" "}
                            {teachers.data?.find((t) => t.id === a.teacher_id)
                              ?.name ?? "Docente non disponibile"}
                          </label>
                        ))}
                    </section>
                  )}
                </section>
              )}
              {step === 4 && preview && (
                <section className="card">
                  <h2>Anteprima verificata dal server</h2>
                  <p>
                    Anno: {sy?.label as string} →{" "}
                    {target === "new"
                      ? year.label
                      : text(
                          data.school_years?.find((y) => y.id === target),
                          "label",
                        )}
                  </p>
                  <div className="v12-grid">
                    {outcomes.map((o) => (
                      <p key={o}>
                        {tr(o)}:{" "}
                        {active.filter((e) => decision(e).outcome === o).length}
                      </p>
                    ))}
                  </div>
                  <p>
                    Nuove iscrizioni:{" "}
                    {
                      active.filter((e) =>
                        ["promoted", "repeating"].includes(decision(e).outcome),
                      ).length
                    }
                    . Materie proposte:{" "}
                    {(preview.plan as { copies: unknown[] })?.copies.length ??
                      0}
                    . Docenti confermati: {confirmedTeachers.length}.
                  </p>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Studente</th>
                          <th>Esito</th>
                          <th>Destinazione</th>
                          <th>Registro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {active.map((e) => (
                          <tr key={e.id}>
                            <td>{label("enrollments", e, data)}</td>
                            <td>{tr(decision(e).outcome)}</td>
                            <td>
                              {destinations.find(
                                (d) => d.id === decision(e).destination_id,
                              )?.name ?? "Nessuna"}
                            </td>
                            <td>{decision(e).register_number || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      checked={approved}
                      onChange={(e) => setApproved(e.target.checked)}
                    />
                    Approvo gli esiti, le destinazioni, i numeri e gli incarichi
                    mostrati. Confermo il passaggio anno.
                  </label>
                </section>
              )}
              <div className="wizard-actions">
                <button
                  className="button"
                  disabled={busy || step === 0}
                  onClick={() => {
                    setStep(step - 1);
                    setPreview(undefined);
                    setApproved(false);
                  }}
                >
                  Indietro
                </button>
                {step < 3 ? (
                  <button
                    className="button primary"
                    disabled={
                      busy || !source || !school || !sourceClasses.length
                    }
                    onClick={() => setStep(step + 1)}
                  >
                    Continua
                  </button>
                ) : step === 3 ? (
                  <button
                    className="button primary"
                    disabled={busy || !online}
                    onClick={() => void review()}
                  >
                    Verifica anteprima
                  </button>
                ) : (
                  <button
                    className="button primary"
                    disabled={busy || !online || !approved}
                    onClick={() => void apply()}
                  >
                    {busy ? "Applicazione…" : "Applica passaggio anno"}
                  </button>
                )}
              </div>
            </>
          )}
          <details>
            <summary>
              Operazioni applicate ({history.data?.length ?? 0})
            </summary>
            {history.data?.map((r) => (
              <p key={r.id}>
                {new Date(r.created_at).toLocaleString("it-IT")} · {r.id} ·{" "}
                {r.status}
              </p>
            ))}
          </details>
        </>
      )}
    </div>
  );
}
