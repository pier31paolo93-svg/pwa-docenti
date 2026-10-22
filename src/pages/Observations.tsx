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
export function Observations() {
  const { data, filters, save } = useData();
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
      (e) => e.class_id === selected?.class_id && !e.ends_on,
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
      await save(
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
      {!selected || !selectedType ? (
        <Empty
          title="Prepara le osservazioni"
          description="Servono un’assegnazione docente e almeno un tipo di osservazione."
          to="/organizzazione"
        />
      ) : (
        <div className="student-grid">
          {students.map((e) => (
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
