import type { DataMap } from "./catalog";
import type { Row, SourceName, TableName } from "../types/model";

// The transition RPC requires a complete roster. "pending" leaves the record
// unchanged: no new enrollment, no date or outcome update for a hidden withdrawal.
export function preservedWithdrawals(data: DataMap, sourceClasses: string[]) {
  return (data.enrollments ?? [])
    .filter(
      (e) =>
        !e.deleted_at &&
        !e.ends_on &&
        e.outcome === "withdrawn" &&
        sourceClasses.includes(String(e.class_id)),
    )
    .map((e) => ({
      enrollment_id: e.id,
      version: e.version,
      outcome: "pending",
      destination_id: null,
      register_number: null,
    }));
}

// Presentation only: keep the canonical records and all historical evidence intact.
export function withdrawalVisibility(data: DataMap, year = "", classId = "") {
  const withdrawn = (data.enrollments ?? []).filter(
    (e) => !e.deleted_at && e.outcome === "withdrawn",
  );
  const blocked = new Map<string, Set<string>>([
    ["enrollments", new Set(withdrawn.map((e) => e.id))],
  ]);
  const scope = (e: Row) =>
    (!classId || e.class_id === classId) &&
    (!year ||
      data.classes?.some(
        (c) => c.id === e.class_id && c.school_year_id === year,
      ));
  const candidates = new Set(withdrawn.map((e) => String(e.student_id)));
  blocked.set(
    "students",
    new Set(
      [...candidates].filter(
        (id) =>
          !(data.enrollments ?? []).some(
            (e) =>
              e.student_id === id &&
              !e.deleted_at &&
              e.outcome !== "withdrawn" &&
              scope(e),
          ),
      ),
    ),
  );
  const references: Record<string, string> = {
    enrollment_id: "enrollments",
    student_id: "students",
    assessment_result_id: "assessment_results",
    homework_check_id: "homework_checks",
    observation_id: "observations",
    question_result_id: "question_results",
    exercise_result_id: "homework_exercise_results",
  };
  function visible(source: SourceName, row: Row) {
    if (blocked.get(source)?.has(row.id)) return false;
    if (source === "students") return !blocked.get("students")?.has(row.id);
    if (
      row.enrollment_id &&
      blocked.get("enrollments")?.has(String(row.enrollment_id))
    )
      return false;
    if (row.student_id) {
      const relevant = (data.enrollments ?? []).filter(
        (e) =>
          e.student_id === row.student_id &&
          !e.deleted_at &&
          (!row.class_id || e.class_id === row.class_id) &&
          (!row.school_year_id ||
            data.classes?.some(
              (c) =>
                c.id === e.class_id && c.school_year_id === row.school_year_id,
            )),
      );
      if (relevant.length && relevant.every((e) => e.outcome === "withdrawn"))
        return false;
    }
    return !Object.entries(references).some(
      ([key, table]) =>
        key !== "student_id" && blocked.get(table)?.has(String(row[key])),
    );
  }
  // Follow indirect evidence links, e.g. correction -> result -> enrollment.
  let changed = true;
  while (changed) {
    changed = false;
    for (const [source, rows] of Object.entries(data)) {
      for (const row of rows ?? []) {
        if (!visible(source as TableName, row)) {
          const ids = blocked.get(source) ?? new Set<string>();
          if (!ids.has(row.id)) {
            ids.add(row.id);
            blocked.set(source, ids);
            changed = true;
          }
        }
      }
    }
  }
  return {
    visible,
    data: Object.fromEntries(
      Object.entries(data).map(([source, rows]) => [
        source,
        rows?.filter((r) => visible(source as TableName, r)),
      ]),
    ) as DataMap,
  };
}
