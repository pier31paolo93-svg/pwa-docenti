import { useState } from "react";
import { useData } from "../state/data";
import { useAuth } from "../state/auth";
import { usePermissions } from "../hooks/permissions";
import { label, derivePatch } from "../domain/catalog";
import { text, today, type Row } from "../types/model";
import { PageTitle, ErrorBox, Modal, Empty } from "../components/ui";
import { EntityForm } from "../components/EntityForm";
import { GradeEditor } from "../components/GradeEditor";
import { ResourcePage } from "./Resources";
import { currentAssignments } from "../domain/context";
import { useCompact } from "../hooks/viewport";
export function Observations() {
  const { data, filters, save, online } = useData();
  const compact = useCompact();
  const [search, setSearch] = useState("");
  const [student, setStudent] = useState("");
  const [feedback, setFeedback] = useState("");
  const [last, setLast] = useState<Row>();
  const [correction, setCorrection] = useState("");
  const { session, workspace } = useAuth();
  const { writable } = usePermissions();
  const [ta, setTa] = useState("");
  const [type, setType] = useState("");
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState<Row | null | undefined>();
  const [graded, setGraded] = useState<Row>();
  const assignments = currentAssignments(data, filters);
  const selected = assignments.find((t) => t.id === ta) ?? assignments[0];
  const types = data.observation_types ?? [];
  const selectedType = types.find((t) => t.id === type) ?? types[0];
  const students =
    data.enrollments?.filter(
      (e) =>
        e.class_id === selected?.class_id &&
        !e.ends_on &&
        !e.deleted_at &&
        label("enrollments", e, data)
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()),
    ) ?? [];
  let shortcuts = [
    "Partecipa con continuità",
    "Richiede supporto",
    "Intervento pertinente",
  ];
  try {
    shortcuts =
      JSON.parse(
        localStorage.getItem("quick:" + session?.user.id + ":" + workspace) ||
          "null",
      ) ?? shortcuts;
  } catch {
    /* Use built-in descriptive shortcuts. */
  }
  async function quick(e: Row, note: string) {
    if (!selected || !selectedType) return;
    setBusy(e.id);
    setError(undefined);
    try {
      const saved = await save(
        "observations",
        derivePatch(
          "observations",
          {
            teaching_assignment_id: selected.id,
            enrollment_id: e.id,
            observation_type_id: selectedType.id,
            observed_on: today(),
            mode: "DESCRIPTIVE",
            notes: note,
            visibility: "workspace",
          },
          data,
        ),
      );
      setLast(saved);
      setCorrection(note);
      setFeedback(
        `${label("enrollments", e, data)}: ${online ? "osservazione salvata" : "in attesa di sincronizzazione"}.`,
      );
    } catch (err) {
      setError(err);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="UNO SGUARDO ALLA CLASSE"
        title="Osservazioni rapide"
        subtitle="Scegli classe e tipo, poi annota con un tocco. Le osservazioni descrittive non generano voti."
        action={
          writable("observations") && (
            <button className="button primary" onClick={() => setEditing(null)}>
              Osservazione dettagliata
            </button>
          )
        }
      />
      <ErrorBox error={error} />
      <p role="status" aria-live="polite">
        {feedback}
      </p>
      <div className="section-toolbar">
        <label>
          Classe e materia
          <select
            value={selected?.id ?? ""}
            onChange={(e) => setTa(e.target.value)}
          >
            {assignments.map((t) => (
              <option key={t.id} value={t.id}>
                {label("teaching_assignments", t, data)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo
          <select
            value={selectedType?.id ?? ""}
            onChange={(e) => setType(e.target.value)}
          >
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {text(t, "description")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="student-correction-toolbar">
        <label>
          Cerca studente
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {compact && (
          <label>
            Studente
            <select
              value={
                (students.find((e) => e.id === student) ?? students[0])?.id ??
                ""
              }
              onChange={(e) => setStudent(e.target.value)}
            >
              {students.map((e) => (
                <option key={e.id} value={e.id}>
                  {label("enrollments", e, data)}
                </option>
              ))}
            </select>
          </label>
        )}
        {compact && students.length > 0 && (
          <div className="form-actions">
            <button
              className="button"
              disabled={
                !!busy ||
                students.findIndex(
                  (e) => e.id === (student || students[0]?.id),
                ) <= 0
              }
              onClick={() =>
                setStudent(
                  students[
                    Math.max(0, students.findIndex((e) => e.id === student) - 1)
                  ].id,
                )
              }
            >
              Studente precedente
            </button>
            <button
              className="button"
              disabled={
                !!busy ||
                students.findIndex(
                  (e) => e.id === (student || students[0]?.id),
                ) >=
                  students.length - 1
              }
              onClick={() =>
                setStudent(
                  students[
                    Math.min(
                      students.length - 1,
                      Math.max(
                        0,
                        students.findIndex((e) => e.id === student),
                      ) + 1,
                    )
                  ].id,
                )
              }
            >
              Studente successivo
            </button>
          </div>
        )}
      </div>
      {last && (
        <section className="card" aria-label="Correggi ultima osservazione">
          <label>
            Testo ultima osservazione
            <input
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
            />
          </label>
          <button
            className="button"
            disabled={!!busy || !correction.trim()}
            onClick={() => {
              setBusy(last.id);
              void save("observations", { notes: correction }, last)
                .then((r) => {
                  setLast(r);
                  setFeedback(
                    online
                      ? "Osservazione corretta e salvata."
                      : "Correzione in attesa di sincronizzazione.",
                  );
                })
                .catch(setError)
                .finally(() => setBusy(""));
            }}
          >
            Salva correzione
          </button>
        </section>
      )}
      {!selected || !selectedType ? (
        <Empty
          title="Prepara le osservazioni"
          description="Servono un’assegnazione docente e almeno un tipo di osservazione."
          to="/organizzazione"
        />
      ) : (
        <div className="student-grid">
          {(compact
            ? students.filter(
                (e) =>
                  e.id ===
                  (students.find((s) => s.id === student) ?? students[0])?.id,
              )
            : students
          ).map((e) => (
            <article className="card" key={e.id}>
              <h3>{label("enrollments", e, data)}</h3>
              <div className="quick-buttons">
                {shortcuts.map((s) => (
                  <button
                    key={s}
                    className="button"
                    disabled={busy === e.id || !writable("observations")}
                    onClick={() => void quick(e, s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
      <ResourcePage resource="observations" />
      {editing !== undefined && (
        <Modal
          title="Osservazione dettagliata"
          close={() => setEditing(undefined)}
        >
          <EntityForm
            table="observations"
            row={editing ?? undefined}
            initial={{
              teaching_assignment_id: selected?.id,
              observation_type_id: selectedType?.id,
            }}
            done={() => setEditing(undefined)}
            onSaved={(r) => {
              if (r.mode === "GRADED") setGraded(r);
            }}
          />
        </Modal>
      )}
      {graded && (
        <Modal
          title="Conferma della valutazione"
          close={() => setGraded(undefined)}
        >
          <GradeEditor
            source={graded}
            origin="observation"
            enrollment={text(graded, "enrollment_id")}
            assignment={text(graded, "teaching_assignment_id")}
          />
        </Modal>
      )}
    </>
  );
}
