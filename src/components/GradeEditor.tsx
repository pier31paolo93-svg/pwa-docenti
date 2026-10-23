import { useState } from "react";
import { useData } from "../state/data";
import { usePermissions } from "../hooks/permissions";
import { ErrorBox, ModalActions, useModalClean } from "./ui";
import { useUnsavedChanges } from "../hooks/unsaved";
import { text, today, type Row, type Patch } from "../types/model";
import { tr, label } from "../domain/catalog";
export function GradeEditor({
  source,
  origin,
  enrollment,
  assignment,
  disabled = false,
  requireReview = false,
  fixedRule = false,
}: {
  source: Row;
  origin: "assessment" | "observation" | "homework";
  enrollment: string;
  assignment: string;
  disabled?: boolean;
  requireReview?: boolean;
  fixedRule?: boolean;
}) {
  const { data, save, online } = useData();
  const { writable } = usePermissions();
  const fk =
    origin === "assessment"
      ? "assessment_result_id"
      : origin === "observation"
        ? "observation_id"
        : "homework_check_id";
  const existing = data.grade_entries?.find((g) => g[fk] === source.id);
  const [saved, setSaved] = useState<Row | undefined>(existing);
  const row =
    saved && Number(saved.version) >= Number(existing?.version ?? 0)
      ? saved
      : existing;
  const [category, setCategory] = useState(text(existing, "category_id"));
  const [rule, setRule] = useState(
    text(existing, "rule_id") ||
      text(
        data.assessments?.find((a) => a.id === source.assessment_id),
        "evaluation_rule_id",
      ),
  );
  const [value, setValue] = useState(text(existing, "confirmed_value"));
  const [weight, setWeight] = useState(text(existing, "weight") || "1");
  const [reason, setReason] = useState("");
  const [excluded, setExcluded] = useState(!!existing?.excluded_from_average);
  const [behavior, setBehavior] = useState(
    !!existing?.allow_behavior_in_average,
  );
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [dirty, setDirty] = useState(false);
  const cleanModal = useModalClean();
  useUnsavedChanges(dirty);
  async function submit(confirm: boolean) {
    setBusy(true);
    setError(undefined);
    try {
      if (!category || !rule)
        throw new Error(
          "Scegli categoria e regola prima di registrare il voto.",
        );
      if (confirm && (!value || !Number.isFinite(Number(value))))
        throw new Error("Indica il voto da confermare.");
      if (confirm && row?.status === "confirmed" && !reason.trim())
        throw new Error("Motiva la modifica di un voto confermato.");
      const patch: Patch = {
        suggested_value: null,
        confirmed_value: confirm ? Number(value) : null,
        weight: Number(weight),
        status: confirm ? "confirmed" : "draft",
        excluded_from_average: excluded,
        allow_behavior_in_average: behavior,
        change_reason: reason || "Prima conferma esplicita del docente",
      };
      if (row?.status === "confirmed" && !confirm)
        throw new Error(
          "Un voto confermato si modifica con una nuova conferma motivata.",
        );
      if (!row)
        Object.assign(patch, {
          enrollment_id: enrollment,
          teaching_assignment_id: assignment,
          class_id: text(
            data.teaching_assignments?.find((t) => t.id === assignment),
            "class_id",
          ),
          category_id: category,
          rule_id: rule,
          graded_on: today(),
          origin,
          [fk]: source.id,
          visibility: source.visibility ?? "workspace",
        });
      const result = await save("grade_entries", patch, row);
      setSaved(result);
      setDirty(false);
      cleanModal?.();
      setReview(false);
      setFeedback(
        confirm
          ? "Voto confermato nel registro."
          : "Bozza salvata. Verifica la proposta prima della conferma.",
      );
      if (result.suggested_value != null && !confirm)
        setValue(String(result.suggested_value));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="card grade-editor"
      onChangeCapture={() => {
        setDirty(true);
        setReview(false);
      }}
    >
      <h3>Voto finale</h3>
      <p className="muted">
        La proposta è calcolata dal database. Solo la conferma del docente entra
        nel registro canonico.
      </p>
      <ErrorBox error={error} />
      <div className="form-grid">
        <label>
          Categoria
          <select
            aria-label="Categoria"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={!!row}
          >
            <option value="">Scegli…</option>
            {data.evaluation_categories?.map((c) => (
              <option value={c.id} key={c.id}>
                {text(c, "name")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Regola
          <select
            aria-label="Regola"
            value={rule}
            onChange={(e) => setRule(e.target.value)}
            disabled={!!row || fixedRule}
          >
            <option value="">Scegli…</option>
            {data.evaluation_rules?.map((c) => (
              <option value={c.id} key={c.id}>
                {text(c, "name")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Voto confermato
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <label>
          Peso
          <input
            type="number"
            inputMode="decimal"
            min="0.001"
            step="any"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </label>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={excluded}
            onChange={(e) => setExcluded(e.target.checked)}
          />
          Escludi dalla media
        </label>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={behavior}
            onChange={(e) => setBehavior(e.target.checked)}
          />
          Consenti esplicitamente il voto comportamentale
        </label>
        <label className="wide">
          Motivazione della modifica
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      </div>
      {row && (
        <p>
          Stato: {tr(text(row, "status"))} · Proposta:{" "}
          {text(row, "suggested_value") || "—"}
        </p>
      )}
      <p role="status" aria-live="polite">
        {feedback}
      </p>
      {review && (
        <div
          className="grade-review"
          role="region"
          aria-label="Riepilogo prima della conferma"
        >
          <h4>Riepilogo del voto</h4>
          <p>
            Voto: <strong>{value || "Da indicare"}</strong> · Peso: {weight} ·{" "}
            {excluded ? "Escluso dalla media" : "Incluso nella media"}
          </p>
          <p>
            Studente:{" "}
            {data.enrollments?.find((e) => e.id === enrollment)
              ? label(
                  "enrollments",
                  data.enrollments.find((e) => e.id === enrollment)!,
                  data,
                )
              : "Seleziona studente"}{" "}
            · Categoria:{" "}
            {text(
              data.evaluation_categories?.find((c) => c.id === category),
              "name",
            )}{" "}
            · Regola:{" "}
            {text(
              data.evaluation_rules?.find((r) => r.id === rule),
              "name",
            )}
          </p>
          <button className="button" onClick={() => setReview(false)}>
            Torna alla modifica
          </button>
        </div>
      )}
      <ModalActions>
        <button
          className="button"
          disabled={
            disabled ||
            busy ||
            !online ||
            !writable("grade_entries", row) ||
            row?.status === "confirmed"
          }
          onClick={() => void submit(false)}
        >
          Calcola e salva bozza
        </button>
        <button
          className="button primary"
          disabled={disabled || busy || !writable("grade_entries", row)}
          onClick={() => {
            if ((requireReview || window.matchMedia("(max-width: 640px)").matches) && !review)
              setReview(true);
            else void submit(true);
          }}
        >
          {review ? "Conferma definitiva" : "Conferma voto"}
        </button>
      </ModalActions>
    </section>
  );
}
