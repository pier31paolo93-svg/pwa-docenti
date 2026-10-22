import { useCapabilities } from "../hooks/capabilities";
import { useState, useId } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { catalog, derivePatch, label, tr, type Field } from "../domain/catalog";
import { formSchema, serialize } from "../domain/validation";
import { useData } from "../state/data";
import { useAuth } from "../state/auth";
import { useTeachers } from "../hooks/teachers";
import { validTeacher } from "../domain/teachers";
import { TeacherPicker } from "./TeacherPicker";
import type { Row, TableName, Patch } from "../types/model";

import { ErrorBox, ModalActions, useModalClose } from "./ui";
export function EntityForm({
  table,
  row,
  initial = {},
  done,
  onSaved,
}: {
  table: TableName;
  row?: Row;
  initial?: Patch;
  done: () => void;
  onSaved?: (row: Row) => void;
}) {
  const spec = catalog[table]!;
  const formId = useId();
  const closeModal = useModalClose();
  const { data, save, filters } = useData();
  const { session } = useAuth();
  const [error, setError] = useState<unknown>();
  const privacy: Field = {
    name: "visibility",
    label: "Visibilità",
    type: "select",
    required: true,
    options: ["workspace", "private"],
    default: "workspace",
  };
  const capabilities = useCapabilities();
  const fields = [
    ...spec.fields,
    ...(table === "assessments" && capabilities.data?.extendedHomework
      ? [
          {
            name: "evaluation_rule_id",
            label: "Regola di valutazione predefinita",
            type: "select",
            ref: "evaluation_rules",
          } as Field,
        ]
      : []),
    ...(!row ? [privacy] : []),
  ];
  const defaults: Record<string, unknown> = {};
  for (const f of fields) {
    let v: unknown =
      row?.[f.name] ??
      initial[f.name] ??
      f.default ??
      (f.type === "checkbox" ? false : "");
    if (f.name === "class_id" && !v) v = filters.classId;
    if (f.name === "subject_id" && !v) v = filters.subject;
    if (f.name === "school_id" && !v) v = filters.school;
    if (f.name === "school_year_id" && !v) v = filters.year;
    if (f.name === "teacher_id" && !v) v = session?.user.id;
    if (f.type === "json" && typeof v !== "string")
      v = JSON.stringify(v, null, 2);
    if (f.type === "datetime-local" && v)
      v = new Date(String(v))
        .toLocaleString("sv-SE")
        .slice(0, 16)
        .replace(" ", "T");
    defaults[f.name] = v;
  }
  const form = useForm<Record<string, unknown>>({
    defaultValues: defaults,
    resolver: zodResolver(formSchema(fields)),
  });
  const values = form.watch();
  const members = useTeachers(table === "teaching_assignments");
  async function submit(values: Record<string, unknown>) {
    try {
      setError(undefined);
      if (
        table === "teaching_assignments" &&
        !row &&
        (members.isFetching ||
          members.isError ||
          !validTeacher(values.teacher_id, members.data ?? []))
      ) {
        form.setError("teacher_id", {
          message: "Seleziona un docente autorizzato del workspace corrente.",
        });
        return;
      }
      let patch = derivePatch(table, serialize(fields, values), data);
      if (row) {
        for (const key of Object.keys(patch))
          if (key.endsWith("_id")) delete patch[key];
        if (table === "question_results") delete patch.max_score_snapshot;
        if (table === "rubric_scores")
          for (const k of [
            "criterion_label_snapshot",
            "levels_snapshot",
            "max_score_snapshot",
            "weight_snapshot",
          ])
            delete patch[k];
      }
      const saved = await save(table, patch, row);
      done();
      onSaved?.(saved);
    } catch (e) {
      setError(e);
    }
  }
  function options(f: Field): Row[] {
    const rows = f.ref === "members" ? [] : (data[f.ref as TableName] ?? []);
    return rows.filter((r) => {
      if (r.deleted_at) return false;
      if (f.ref === "enrollments") {
        const ta = data.teaching_assignments?.find(
          (t) => t.id === values.teaching_assignment_id,
        );
        const ass = data.assignments?.find(
          (t) => t.id === values.assignment_id,
        );
        const a = data.assessments?.find((t) => t.id === values.assessment_id);
        const cls =
          ta?.class_id ?? ass?.class_id ?? a?.class_id ?? filters.classId;
        return !cls || r.class_id === cls;
      }
      if (f.ref === "assignment_exercises") {
        const h = data.homework_checks?.find(
          (h) => h.id === values.homework_check_id,
        );
        return !h || r.assignment_id === h.assignment_id;
      }
      if (f.ref === "assessment_questions") {
        const result = data.assessment_results?.find(
          (x) => x.id === values.assessment_result_id,
        );
        const aid = values.assessment_id ?? result?.assessment_id;
        return (!aid || r.assessment_id === aid) && r.id !== row?.id;
      }
      if (f.ref === "teaching_assignments") {
        return !filters.classId || r.class_id === filters.classId;
      }
      return true;
    });
  }
  return (
    <form
      id={formId}
      onSubmit={form.handleSubmit(submit)}
      className="form-grid entity-form"
      aria-label={"Dati " + spec.singular}
    >
      {fields.map((f) =>
        f.name === "teacher_id" ? (
          <div key={f.name}>
            <TeacherPicker
              teachers={members.data ?? []}
              value={String(values.teacher_id ?? "")}
              disabled={!!row}
              loading={members.isPending}
              error={members.isError}
              onChange={(id) => {
                form.setValue("teacher_id", id, { shouldValidate: true });
              }}
            />
            {form.formState.errors.teacher_id && (
              <small className="field-error">
                {String(form.formState.errors.teacher_id.message)}
              </small>
            )}
          </div>
        ) : (
          <label
            className={f.type === "textarea" || f.type === "json" ? "wide" : ""}
            key={f.name}
          >
            <span>
              {f.label}
              {f.required ? " *" : ""}
            </span>
            {f.type === "select" ? (
              <select
                {...form.register(f.name)}
                aria-label={f.label + (f.required ? " *" : "")}
                disabled={!!row && f.name.endsWith("_id")}
              >
                <option value="">Seleziona…</option>
                {f.ref
                  ? options(f).map((r) => (
                      <option value={r.id} key={r.id}>
                        {label(f.ref!, r, data)}
                      </option>
                    ))
                  : f.options?.map((v) => (
                      <option key={v} value={v}>
                        {tr(v)}
                      </option>
                    ))}
              </select>
            ) : f.type === "textarea" || f.type === "json" ? (
              <textarea
                {...form.register(f.name)}
                aria-label={f.label + (f.required ? " *" : "")}
                rows={f.type === "json" ? 5 : 3}
                spellCheck={f.type !== "json"}
              />
            ) : f.type === "checkbox" ? (
              <input type="checkbox" {...form.register(f.name)} />
            ) : (
              <input
                type={f.type}
                aria-label={f.label + (f.required ? " *" : "")}
                aria-invalid={!!form.formState.errors[f.name]}
                aria-describedby={
                  form.formState.errors[f.name]
                    ? `${formId}-${f.name}-error`
                    : undefined
                }
                min={f.min}
                max={f.max}
                step={f.type === "number" ? "any" : undefined}
                inputMode={f.type === "number" ? "decimal" : undefined}
                {...form.register(f.name)}
              />
            )}
            {form.formState.errors[f.name] && (
              <small
                className="field-error"
                id={`${formId}-${f.name}-error`}
                role="alert"
              >
                {String(form.formState.errors[f.name]?.message)}
              </small>
            )}
          </label>
        ),
      )}
      {row && (
        <p className="wide muted">
          Revisione {row.version}. I riferimenti storici e la visibilità
          rimangono invariati.
        </p>
      )}
      <div className="wide">
        <ErrorBox error={error} />
      </div>
      <div className="wide">
        <ModalActions>
          <button type="button" className="button" onClick={closeModal ?? done}>
            Annulla
          </button>
          <button
            className="button primary"
            type="submit"
            form={formId}
            disabled={
              form.formState.isSubmitting ||
              (table === "teaching_assignments" &&
                !row &&
                (members.isFetching || members.isError))
            }
          >
            {form.formState.isSubmitting
              ? "Salvataggio…"
              : row
                ? "Salva modifiche"
                : "Crea " + spec.singular}
          </button>
        </ModalActions>
      </div>
    </form>
  );
}
