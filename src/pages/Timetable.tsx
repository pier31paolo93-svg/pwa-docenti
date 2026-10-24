import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../state/auth";
import { useData } from "../state/data";
import { useTimetable } from "../hooks/timetable";
import { useTeachers } from "../hooks/teachers";
import { useUnsavedChanges } from "../hooks/unsaved";
import { PageTitle, ErrorBox } from "../components/ui";
import { label } from "../domain/catalog";
import { weekdays, duration, weekday } from "../domain/timetable";
import { today, type Row, type Patch } from "../types/model";
const formValue = (form: FormData, key: string) => String(form.get(key) ?? "");
export function Timetable() {
  const auth = useAuth(),
    { data, filters } = useData(),
    t = useTimetable();
  const admin = auth.role === "owner" || auth.role === "admin",
    teachers = useTeachers(admin),
    [params] = useSearchParams();
  const [year, setYear] = useState(
      params.get("targetYear") || filters.year || "",
    ),
    [school, setSchool] = useState(filters.school),
    [teacher, setTeacher] = useState(auth.session!.user.id),
    [kind, setKind] = useState(""),
    [id, setId] = useState("");
  const [day, setDay] = useState(weekday(today())),
    [sunday, setSunday] = useState(false),
    [daily, setDaily] = useState(false),
    [date, setDate] = useState(today());
  const [edit, setEdit] = useState<Row>(),
    [cls, setCls] = useState(""),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(""),
    [dirty, setDirty] = useState(false);
  const [cloneSource, setCloneSource] = useState(""),
    [previous, setPrevious] = useState(""),
    [activation, setActivation] = useState(false);
  const [creating, setCreating] = useState(false);
  useUnsavedChanges(dirty);
  const versions = t.timetable.versions.filter(
    (v) =>
      v.school_year_id === year &&
      v.teacher_id === teacher &&
      (!kind || v.kind === kind),
  );
  const v = versions.find((v) => v.id === id) ?? versions[0];
  const slots = t.timetable.slots.filter(
    (s) => s.timetable_version_id === v?.id,
  );
  const assignments = (data.teaching_assignments ?? []).filter(
    (a) =>
      a.teacher_id === teacher &&
      data.classes?.some(
        (c) =>
          c.id === a.class_id &&
          c.school_year_id === year &&
          (!school || c.school_id === school),
      ),
  );
  const classes = (data.classes ?? []).filter(
    (c) => c.school_year_id === year && (!school || c.school_id === school),
  );
  const canWrite = admin || auth.role === "teacher",
    draft = v?.status === "draft";
  const draftForm = draft && !creating;
  const slotVisible = (s: Row) =>
    !school || assignments.some((a) => a.id === s.teaching_assignment_id);
  const weekSlots = slots.filter(
    (s) => slotVisible(s) && (sunday || Number(s.weekday) < 7),
  );
  const bands = [
    ...new Set(
      weekSlots.flatMap((s) => [
        String(s.starts_at).slice(0, 5),
        String(s.ends_at).slice(0, 5),
      ]),
    ),
  ].sort();
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await fn();
      setDirty(false);
      setFeedback("Salvato e verificato dal server.");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const assignmentLabel = (a: Row) => label("teaching_assignments", a, data);
  const selectedClone = t.timetable.versions.find((x) => x.id === cloneSource);
  const sourceSlots = t.timetable.slots.filter(
    (x) => x.timetable_version_id === cloneSource,
  );
  const sourceAssignments = [
    ...new Set(sourceSlots.map((s) => String(s.teaching_assignment_id))),
  ];
  useEffect(() => {
    if (!year) {
      const current = data.school_years?.find(
        (y) => String(y.starts_on) <= today() && String(y.ends_on) >= today(),
      );
      if (current) setYear(current.id);
    }
  }, [data.school_years, year]);
  useEffect(() => {
    if (!cloneSource && params.get("sourceYear")) {
      const source = t.timetable.versions
        .filter(
          (v) =>
            v.school_year_id === params.get("sourceYear") &&
            v.teacher_id === teacher,
        )
        .sort((a, b) =>
          String(b.valid_from).localeCompare(String(a.valid_from)),
        )[0];
      if (source) setCloneSource(source.id);
    }
  }, [t.timetable.versions, teacher, cloneSource, params]);
  const input = (
    name: string,
    title: string,
    type = "text",
    value?: unknown,
    required = true,
  ) => (
    <label>
      {title}
      <input
        name={name}
        type={type}
        defaultValue={String(value ?? "")}
        required={required}
      />
    </label>
  );
  const renderSlot = (s: Row) => (
    <article className="card" key={s.id}>
      <strong>
        {String(s.starts_at).slice(0, 5)}–{String(s.ends_at).slice(0, 5)}
      </strong>
      <p>
        {assignmentLabel(
          data.teaching_assignments?.find(
            (a) => a.id === s.teaching_assignment_id,
          ) ?? s,
        )}
      </p>
      <p>
        {duration(String(s.starts_at), String(s.ends_at))} ·{" "}
        {String(
          s.kind === "laboratory"
            ? "Laboratorio"
            : s.kind === "ordinary"
              ? "Ordinaria"
              : "Altro",
        )}
        {s.room ? " · " + String(s.room) : ""}
      </p>
      {!!s.notes && <p>{String(s.notes)}</p>}
      {draft && canWrite && (
        <div className="section-toolbar">
          <button
            className="button"
            disabled={!t.online || busy}
            onClick={() => {
              setEdit(s);
              setCls(
                String(
                  data.teaching_assignments?.find(
                    (a) => a.id === s.teaching_assignment_id,
                  )?.class_id ?? "",
                ),
              );
            }}
          >
            Modifica slot
          </button>
          <button
            className="button"
            disabled={!t.online || busy}
            onClick={() => {
              setEdit({ ...s, id: "" });
              setCls(
                String(
                  data.teaching_assignments?.find(
                    (a) => a.id === s.teaching_assignment_id,
                  )?.class_id ?? "",
                ),
              );
            }}
          >
            Duplica slot
          </button>
          <button
            className="button"
            disabled={!t.online || busy}
            onClick={() => {
              if (window.confirm("Rimuovere lo slot dalla bozza?"))
                void run(async () => {
                  await t.save(
                    "slots",
                    { deleted_at: new Date().toISOString() },
                    s,
                  );
                });
            }}
          >
            Elimina slot
          </button>
        </div>
      )}
    </article>
  );
  return (
    <>
      <PageTitle
        title="Orario settimanale"
        subtitle="Versioni per anno e docente · Europe/Rome · nessuna lezione creata automaticamente."
      />
      <ErrorBox error={error ?? t.error} />
      {feedback && <p role="status">{feedback}</p>}
      {!t.online && (
        <p className="banner">
          Copia offline potenzialmente non aggiornata. Modifiche e attivazione
          richiedono connessione.
        </p>
      )}
      {t.isPending ? (
        <p>Caricamento orario…</p>
      ) : !t.available ? (
        <p role="alert">
          Orario disponibile dopo la migrazione V1.5 (27), da autorizzare
          separatamente. Le altre funzioni restano disponibili.
        </p>
      ) : (
        <>
          <div className="card form-grid">
            <label>
              Anno scolastico
              <select
                aria-label="Anno orario"
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  setId("");
                  setEdit(undefined);
                }}
              >
                <option value="">Scegli anno</option>
                {data.school_years?.map((y) => (
                  <option key={y.id} value={y.id}>
                    {String(y.label)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Scuola
              <select
                aria-label="Scuola orario"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
              >
                <option value="">Tutte le scuole</option>
                {data.schools?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {String(s.name)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Docente
              <select
                aria-label="Docente orario"
                value={teacher}
                disabled={!admin}
                onChange={(e) => {
                  setTeacher(e.target.value);
                  setId("");
                  setEdit(undefined);
                }}
              >
                <option value={auth.session!.user.id}>Il mio orario</option>
                {teachers.data
                  ?.filter((x) => x.id !== auth.session!.user.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                      {x.email ? " · " + x.email : ""}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Tipologia orario
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">Tutte</option>
                <option value="provisional">Provvisorio</option>
                <option value="definitive">Definitivo</option>
              </select>
            </label>
            <label>
              Versione
              <select
                aria-label="Versione orario"
                value={v?.id ?? ""}
                onChange={(e) => {
                  setId(e.target.value);
                  setEdit(undefined);
                  setActivation(false);
                }}
              >
                <option value="">Scegli versione</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {String(v.name)} ·{" "}
                    {v.status === "draft"
                      ? "Bozza"
                      : v.status === "active"
                        ? "Attivo"
                        : "Archiviato"}{" "}
                    · {String(v.valid_from)} /{" "}
                    {String(v.valid_to ?? "fine anno")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {canWrite && (
            <details className="card">
              <summary>Crea o modifica versione in bozza</summary>
              {draft && !creating && (
                <button
                  className="button"
                  onClick={() => {
                    if (
                      !dirty ||
                      window.confirm("Abbandonare le modifiche non salvate?")
                    ) {
                      setCreating(true);
                      setDirty(false);
                    }
                  }}
                >
                  Prepara un’altra versione
                </button>
              )}
              <form
                key={draftForm ? v?.id : "new" + year + teacher}
                onChange={() => setDirty(true)}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void run(async () => {
                    const row = await t.save(
                      "versions",
                      {
                        name: formValue(f, "name"),
                        kind: formValue(f, "kind"),
                        valid_from: formValue(f, "valid_from"),
                        valid_to: formValue(f, "valid_to") || null,
                        ...(!draftForm
                          ? { school_year_id: year, teacher_id: teacher }
                          : {}),
                      },
                      draftForm ? v : undefined,
                    );
                    setId(row.id);
                    setCreating(false);
                  });
                }}
              >
                <div className="form-grid">
                  {input(
                    "name",
                    "Nome versione",
                    "text",
                    draftForm ? v?.name : "",
                  )}
                  <label>
                    Tipo versione
                    <select
                      name="kind"
                      defaultValue={draftForm ? String(v?.kind) : "provisional"}
                    >
                      <option value="provisional">Provvisorio</option>
                      <option value="definitive">Definitivo</option>
                    </select>
                  </label>
                  {input(
                    "valid_from",
                    "Inizio validità",
                    "date",
                    draftForm
                      ? v?.valid_from
                      : data.school_years?.find((y) => y.id === year)
                          ?.starts_on,
                  )}
                  {input(
                    "valid_to",
                    "Fine validità (opzionale)",
                    "date",
                    draftForm ? v?.valid_to : "",
                    false,
                  )}
                </div>
                <button
                  className="button primary"
                  disabled={!t.online || busy || !year}
                >
                  {draftForm ? "Salva versione" : "Crea versione"}
                </button>
              </form>
              <p>
                Per modifiche future duplica una versione pubblicata e cambia la
                decorrenza della nuova bozza.
              </p>
            </details>
          )}
          {v && (
            <>
              <section className="card">
                <h2>{String(v.name)}</h2>
                <p>
                  {String(v.valid_from)} — {String(v.valid_to ?? "fine anno")} ·
                  Creata {String(v.created_at).slice(0, 10)} · Modificata{" "}
                  {String(v.updated_at).slice(0, 10)}
                  {" · Autore: " +
                    (v.created_by === auth.session!.user.id
                      ? String(auth.identity.profile?.display_name || "Tu")
                      : teachers.data?.find((x) => x.id === v.created_by)
                          ?.name || "Utente autorizzato del workspace")}
                </p>
                {canWrite &&
                  v.status === "active" &&
                  !!v.valid_to &&
                  String(v.valid_to) < today() && (
                    <button
                      className="button"
                      disabled={!t.online || busy}
                      onClick={() =>
                        void run(async () => {
                          await t.save("versions", { status: "archived" }, v);
                        })
                      }
                    >
                      Archivia periodo terminato
                    </button>
                  )}
                <div className="section-toolbar">
                  <label>
                    <input
                      type="checkbox"
                      checked={daily}
                      onChange={(e) => setDaily(e.target.checked)}
                    />
                    Vista giornaliera
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={sunday}
                      onChange={(e) => {
                        setSunday(e.target.checked);
                        if (!e.target.checked && day === 7) setDay(1);
                      }}
                    />
                    Mostra domenica
                  </label>
                  <label>
                    Giorno
                    <select
                      aria-label="Giorno orario"
                      value={day}
                      onChange={(e) => {
                        setDay(Number(e.target.value));
                        if (Number(e.target.value) === 7) setSunday(true);
                      }}
                    >
                      {weekdays.map((d, i) => (
                        <option key={d} value={i + 1}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {!daily && bands.length > 1 && (
                  <table className="timetable-matrix">
                    <caption>Settimana · fasce configurate</caption>
                    <thead>
                      <tr>
                        <th scope="col">Fascia</th>
                        {weekdays.slice(0, sunday ? 7 : 6).map((d) => (
                          <th scope="col" key={d}>
                            {d}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bands.slice(0, -1).map((start, i) => (
                        <tr key={start}>
                          <th scope="row">
                            {start}–{bands[i + 1]}
                          </th>
                          {weekdays.slice(0, sunday ? 7 : 6).map((d, index) => {
                            const slot = weekSlots.find(
                              (s) =>
                                Number(s.weekday) === index + 1 &&
                                String(s.starts_at).slice(0, 5) <= start &&
                                String(s.ends_at).slice(0, 5) > start,
                            );
                            if (
                              slot &&
                              String(slot.starts_at).slice(0, 5) < start
                            )
                              return null;
                            return (
                              <td
                                key={d}
                                rowSpan={
                                  slot
                                    ? bands.indexOf(
                                        String(slot.ends_at).slice(0, 5),
                                      ) - i
                                    : 1
                                }
                              >
                                {slot ? (
                                  renderSlot(slot)
                                ) : (
                                  <span aria-label="Nessuna lezione">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div
                  className={
                    "timetable-week " + (daily ? "timetable-day-only" : "")
                  }
                  style={
                    {
                      "--timetable-days": sunday ? 7 : 6,
                    } as React.CSSProperties
                  }
                >
                  {weekdays.slice(0, sunday ? 7 : 6).map((d, i) => (
                    <section
                      key={d}
                      className={
                        day === i + 1
                          ? "timetable-day selected"
                          : "timetable-day"
                      }
                    >
                      <h3>{d}</h3>
                      {slots
                        .filter(
                          (s) => Number(s.weekday) === i + 1 && slotVisible(s),
                        )
                        .sort((a, b) =>
                          String(a.starts_at).localeCompare(
                            String(b.starts_at),
                          ),
                        )
                        .map(renderSlot)}
                      {!slots.some(
                        (s) => Number(s.weekday) === i + 1 && slotVisible(s),
                      ) && <p>Nessuno slot</p>}
                    </section>
                  ))}
                </div>
                <p>
                  Le fasce sono definite liberamente dagli slot; la durata è
                  espressa in minuti e ore da 60 minuti.
                </p>
              </section>
              {canWrite && draft && (
                <section className="card">
                  <h2>{edit ? "Modifica o duplica slot" : "Nuovo slot"}</h2>
                  <form
                    key={edit?.id + "-" + String(edit?.starts_at) + "-" + v.id}
                    onChange={() => setDirty(true)}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void run(async () => {
                        const patch: Patch = {
                          timetable_version_id: v.id,
                          teaching_assignment_id: formValue(f, "assignment"),
                          weekday: Number(formValue(f, "weekday")),
                          starts_at: formValue(f, "starts_at"),
                          ends_at: formValue(f, "ends_at"),
                          room: formValue(f, "room") || null,
                          notes: formValue(f, "notes") || null,
                          kind: formValue(f, "kind"),
                        };
                        await t.save(
                          "slots",
                          patch,
                          edit?.id ? edit : undefined,
                        );
                        setEdit(undefined);
                      });
                    }}
                  >
                    <div className="form-grid">
                      <label>
                        Classe slot
                        <select
                          aria-label="Classe slot"
                          value={cls}
                          required
                          onChange={(e) => setCls(e.target.value)}
                        >
                          <option value="">Scegli classe</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {String(c.name)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Materia assegnata
                        <select
                          name="assignment"
                          aria-label="Materia assegnata"
                          required
                          defaultValue={String(
                            edit?.teaching_assignment_id ?? "",
                          )}
                          key={cls + edit?.id}
                        >
                          <option value="">Scegli materia</option>
                          {assignments
                            .filter((a) => a.class_id === cls)
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {assignmentLabel(a)}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Giorno slot
                        <select
                          name="weekday"
                          aria-label="Giorno slot"
                          defaultValue={String(edit?.weekday ?? day)}
                        >
                          {weekdays.map((d, i) => (
                            <option key={d} value={i + 1}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </label>
                      {input(
                        "starts_at",
                        "Inizio slot",
                        "time",
                        edit?.starts_at,
                      )}
                      {input("ends_at", "Fine slot", "time", edit?.ends_at)}
                      <label>
                        Tipo lezione
                        <select
                          name="kind"
                          defaultValue={String(edit?.kind ?? "ordinary")}
                        >
                          <option value="ordinary">Ordinaria</option>
                          <option value="laboratory">Laboratorio</option>
                          <option value="other">Altro</option>
                        </select>
                      </label>
                      {input(
                        "room",
                        "Aula o laboratorio",
                        "text",
                        edit?.room,
                        false,
                      )}
                      {input("notes", "Note slot", "text", edit?.notes, false)}
                    </div>
                    {cls && !assignments.some((a) => a.class_id === cls) && (
                      <p>
                        Non risultano materie assegnate al docente per questa
                        classe. Controlla{" "}
                        <Link to="/archivio/class_subjects">
                          Classi / Materie
                        </Link>{" "}
                        e{" "}
                        <Link to="/archivio/teaching_assignments">
                          Assegnazioni docenti
                        </Link>
                        : nessuna associazione verrà creata automaticamente.
                      </p>
                    )}
                    <button
                      className="button primary"
                      disabled={!t.online || busy}
                    >
                      Salva slot
                    </button>
                    {edit && (
                      <button
                        type="button"
                        className="button"
                        onClick={() => setEdit(undefined)}
                      >
                        Annulla modifica
                      </button>
                    )}
                  </form>
                </section>
              )}
              {canWrite && draft && (
                <section className="card">
                  <h2>Anteprima e attivazione</h2>
                  <p>
                    Controlla la settimana sopra. L’attivazione non crea
                    lezioni. Se sostituisci un orario, la versione precedente
                    terminerà il giorno prima della nuova decorrenza.
                  </p>
                  <label>
                    Versione precedente da chiudere (facoltativa)
                    <select
                      value={previous}
                      onChange={(e) => setPrevious(e.target.value)}
                    >
                      <option value="">Nessuna</option>
                      {versions
                        .filter((x) => x.status === "active" && x.id !== v.id)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {String(x.name)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      checked={activation}
                      onChange={(e) => setActivation(e.target.checked)}
                    />
                    Confermo periodo, slot e chiusura dell’eventuale versione
                    precedente.
                  </label>
                  <button
                    className="button primary"
                    disabled={!t.online || busy || !activation}
                    onClick={() =>
                      void run(async () => {
                        const prev = versions.find((x) => x.id === previous);
                        await t.rpc("activate_timetable", {
                          p_id: v.id,
                          p_version: v.version,
                          p_previous: prev?.id ?? null,
                          p_previous_version: prev?.version ?? null,
                        });
                        setActivation(false);
                      })
                    }
                  >
                    Attiva orario
                  </button>
                </section>
              )}
              {canWrite && !draft && (
                <section className="card">
                  <h2>Variazioni giornaliere</h2>
                  <form
                    onChange={() => setDirty(true)}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void run(async () => {
                        await t.save("exceptions", {
                          timetable_version_id: v.id,
                          occurs_on: date,
                          slot_id: formValue(f, "slot") || null,
                          kind: formValue(f, "kind"),
                          teaching_assignment_id:
                            formValue(f, "assignment") || null,
                          starts_at: formValue(f, "starts_at") || null,
                          ends_at: formValue(f, "ends_at") || null,
                          room: formValue(f, "room") || null,
                          notes: formValue(f, "notes") || null,
                        });
                      });
                    }}
                  >
                    <div className="form-grid">
                      <label>
                        Data variazione
                        <input
                          type="date"
                          required
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                        />
                      </label>
                      <label>
                        Slot da variare
                        <select name="slot">
                          <option value="">Attività aggiuntiva</option>
                          {slots
                            .filter((s) => Number(s.weekday) === weekday(date))
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {String(s.starts_at).slice(0, 5)} ·{" "}
                                {assignmentLabel(
                                  data.teaching_assignments?.find(
                                    (a) => a.id === s.teaching_assignment_id,
                                  ) ?? s,
                                )}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Tipo variazione
                        <select name="kind">
                          {[
                            ["cancelled", "Lezione annullata"],
                            ["substitution", "Sostituzione"],
                            ["room", "Cambio aula/laboratorio"],
                            ["swap", "Scambio ore"],
                            ["trip", "Uscita didattica"],
                            ["reduced", "Orario ridotto"],
                            ["extra", "Attività straordinaria"],
                            ["additional", "Lezione aggiuntiva"],
                          ].map(([key, name]) => (
                            <option key={key} value={key}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Assegnazione sostitutiva
                        <select name="assignment">
                          <option value="">Mantieni classe e materia</option>
                          {assignments.map((a) => (
                            <option key={a.id} value={a.id}>
                              {assignmentLabel(a)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {input("starts_at", "Nuovo inizio", "time", "", false)}
                      {input("ends_at", "Nuova fine", "time", "", false)}
                      {input("room", "Nuova aula", "text", "", false)}
                      {input("notes", "Motivo variazione", "text", "", false)}
                    </div>
                    <button className="button" disabled={!t.online || busy}>
                      Salva variazione
                    </button>
                  </form>
                  <p>
                    Per uno scambio, annulla prima gli slot originali e
                    inserisci gli orari sostitutivi: il server rifiuta
                    sovrapposizioni. Le lezioni già registrate si modificano dal
                    registro.
                  </p>
                  {t.timetable.exceptions
                    .filter(
                      (e) =>
                        e.timetable_version_id === v.id && e.occurs_on === date,
                    )
                    .map((e) => (
                      <article key={e.id}>
                        <p>
                          {String(e.occurs_on)} · {String(e.kind)} ·{" "}
                          {String(e.notes ?? "")}
                        </p>
                        <button
                          className="button"
                          disabled={!t.online || busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Rimuovere questa variazione e ripristinare lo slot previsto?",
                              )
                            )
                              void run(async () => {
                                await t.save(
                                  "exceptions",
                                  { deleted_at: new Date().toISOString() },
                                  e,
                                );
                              });
                          }}
                        >
                          Rimuovi variazione
                        </button>
                      </article>
                    ))}
                </section>
              )}
            </>
          )}
          {canWrite && (
            <details className="card">
              <summary>
                Duplica settimana / copia struttura da altro anno
              </summary>
              <form
                onChange={() => setDirty(true)}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void run(async () => {
                    const map = Object.fromEntries(
                      sourceAssignments.map((a) => [
                        a,
                        formValue(f, "map-" + a),
                      ]),
                    );
                    const newid = await t.rpc<string>("duplicate_timetable", {
                      p_id: cloneSource,
                      p_name: formValue(f, "clone_name"),
                      p_year: year,
                      p_teacher: teacher,
                      p_map: map,
                    });
                    setId(newid);
                  });
                }}
              >
                <div className="form-grid">
                  <label>
                    Orario da copiare
                    <select
                      required
                      value={cloneSource}
                      onChange={(e) => setCloneSource(e.target.value)}
                    >
                      <option value="">Scegli versione</option>
                      {t.timetable.versions.map((x) => (
                        <option key={x.id} value={x.id}>
                          {String(x.name)} ·{" "}
                          {String(
                            data.school_years?.find(
                              (y) => y.id === x.school_year_id,
                            )?.label,
                          )}
                        </option>
                      ))}
                    </select>
                  </label>
                  {input("clone_name", "Nome nuova bozza")}
                </div>
                {selectedClone &&
                  (selectedClone.school_year_id !== year ||
                    selectedClone.teacher_id !== teacher) &&
                  sourceAssignments.map((a) => (
                    <label key={a}>
                      Conferma nuova assegnazione per{" "}
                      {assignmentLabel(
                        data.teaching_assignments?.find((x) => x.id === a) ??
                          ({ id: a } as Row),
                      )}
                      <select name={"map-" + a} required>
                        <option value="">
                          Scegli classe, materia e docente confermato
                        </option>
                        {assignments.map((x) => (
                          <option key={x.id} value={x.id}>
                            {assignmentLabel(x)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                <p>
                  La copia appartiene all’anno selezionato, resta in bozza e non
                  include eccezioni. Nel nuovo anno ogni assegnazione va
                  confermata.
                </p>
                <button
                  className="button"
                  disabled={!year || !cloneSource || !t.online || busy}
                >
                  Crea copia in bozza
                </button>
              </form>
            </details>
          )}
        </>
      )}
    </>
  );
}
