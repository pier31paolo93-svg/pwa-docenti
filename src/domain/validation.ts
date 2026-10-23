import { z } from "zod";
import type { Field } from "./catalog";
import type { Patch } from "../types/model";
export function formSchema(fields: Field[]) {
  return z.record(z.string(), z.unknown()).superRefine((values, ctx) => {
    for (const f of fields) {
      const value = values[f.name];
      const empty = value === "" || value == null;
      const error = (message: string) =>
        ctx.addIssue({ code: "custom", path: [f.name], message });
      if (f.required && empty) {
        error("Campo obbligatorio");
        continue;
      }
      if (empty) continue;
      if (f.type === "number") {
        const n = Number(value);
        if (f.name === "register_number" && !Number.isInteger(n))
          error("Il numero di registro deve essere un intero positivo");
        if (!Number.isFinite(n)) error("Numero non valido");
        else if (f.min != null && n < f.min) error("Minimo " + f.min);
        else if (f.max != null && n > f.max) error("Massimo " + f.max);
      }
      if (
        f.type === "select" &&
        f.options &&
        !f.options.includes(String(value))
      )
        error("Scelta non valida");
      if (f.type === "json") {
        try {
          JSON.parse(String(value));
        } catch {
          error("JSON non valido");
        }
      }
      if (
        (f.type === "date" || f.type === "datetime-local") &&
        Number.isNaN(Date.parse(String(value)))
      )
        error("Data non valida");
    }
    if (
      values.starts_on &&
      values.ends_on &&
      String(values.ends_on) <= String(values.starts_on)
    )
      ctx.addIssue({
        code: "custom",
        path: ["ends_on"],
        message: "La fine deve essere successiva all’inizio",
      });
    if (
      values.starts_at &&
      values.ends_at &&
      String(values.ends_at) <= String(values.starts_at)
    )
      ctx.addIssue({
        code: "custom",
        path: ["ends_at"],
        message: "La fine deve essere successiva all’inizio",
      });
    if (
      values.assigned_on &&
      values.due_on &&
      String(values.due_on) < String(values.assigned_on)
    )
      ctx.addIssue({
        code: "custom",
        path: ["due_on"],
        message: "La scadenza precede l’assegnazione",
      });
    if (
      values.status === "confirmed" &&
      "confirmed_value" in values &&
      (values.confirmed_value === "" || values.confirmed_value == null)
    )
      ctx.addIssue({
        code: "custom",
        path: ["confirmed_value"],
        message: "Conferma un voto numerico",
      });
  });
}
export function serialize(
  fields: Field[],
  values: Record<string, unknown>,
): Patch {
  const patch: Patch = {};
  for (const f of fields) {
    const value = values[f.name];
    if (value == null || value === "") {
      if (!f.required) patch[f.name] = null;
      continue;
    }
    patch[f.name] =
      f.type === "number"
        ? Number(value)
        : f.type === "checkbox"
          ? Boolean(value)
          : f.type === "json"
            ? JSON.parse(String(value))
            : f.type === "datetime-local"
              ? new Date(String(value)).toISOString()
              : String(value);
  }
  return patch;
}
