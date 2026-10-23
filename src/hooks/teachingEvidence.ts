import { useData, useRows } from "../state/data";
import { inContext } from "../domain/context";
import { text, type Row } from "../types/model";
// Aggregate actual evidence after context/date filtering; never estimate skills from grades.
export function useTeachingEvidence(
  student: string | undefined,
  from: string,
  to: string,
  subject = "",
) {
  const { data, filters } = useData();
  const observationErrors = useRows("observation_errors"),
    homeworkErrors = useRows("homework_errors"),
    questionErrors = useRows("question_errors");
  const context = { ...filters, subject: subject || filters.subject };
  const includes = (row: Row | undefined, date: string) =>
    !!row &&
    inContext(row, data, context) &&
    (!from || date >= from) &&
    (!to || date <= to);
  const isStudent = (id: unknown) =>
    !student ||
    data.enrollments?.some((e) => e.id === id && e.student_id === student);
  const observations = new Set(
    (data.observations ?? [])
      .filter(
        (o) =>
          isStudent(o.enrollment_id) && includes(o, text(o, "observed_on")),
      )
      .map((o) => o.id),
  );
  const checks = new Set(
    (data.homework_checks ?? [])
      .filter(
        (h) =>
          isStudent(h.enrollment_id) &&
          includes(
            data.assignments?.find((a) => a.id === h.assignment_id),
            text(h, "checked_on"),
          ),
      )
      .map((h) => h.id),
  );
  const homeworkResults = new Set(
    (data.homework_exercise_results ?? [])
      .filter((r) => checks.has(text(r, "homework_check_id")))
      .map((r) => r.id),
  );
  const results = new Set(
    (data.assessment_results ?? [])
      .filter((r) => {
        const a = data.assessments?.find((a) => a.id === r.assessment_id);
        return (
          r.attendance !== "absent" &&
          isStudent(r.enrollment_id) &&
          includes(a, text(a, "assessed_on"))
        );
      })
      .map((r) => r.id),
  );
  const scores = (data.question_results ?? []).filter(
    (r) => results.has(text(r, "assessment_result_id")) && r.score != null,
  );
  const questionIds = new Set(scores.map((r) => r.id));
  const errors: Record<string, number> = {};
  for (const [rows, foreign, ids] of [
    [observationErrors.data, "observation_id", observations],
    [homeworkErrors.data, "exercise_result_id", homeworkResults],
    [questionErrors.data, "question_result_id", questionIds],
  ] as [Row[] | undefined, string, Set<string>][]) {
    for (const e of rows ?? []) {
      if (!e.deleted_at && ids.has(text(e, foreign)))
        errors[text(e, "error_type_id")] =
          (errors[text(e, "error_type_id")] ?? 0) + 1;
    }
  }
  function aggregate(field: string) {
    const groups: Record<string, number[]> = {};
    for (const r of scores) {
      const q = data.assessment_questions?.find((q) => q.id === r.question_id);
      const id = text(q, field);
      if (id && Number(r.max_score_snapshot) > 0)
        (groups[id] ??= []).push(
          Number(r.score) / Number(r.max_score_snapshot),
        );
    }
    return Object.entries(groups).map(([id, values]) => ({
      id,
      [field]: id,
      average_ratio: values.reduce((a, b) => a + b, 0) / values.length,
      evidence_count: values.length,
    }));
  }
  return {
    errors: Object.entries(errors).map(([id, count]) => ({
      id,
      error_type_id: id,
      occurrences: count,
    })),
    competencies: aggregate("competency_id"),
    topics: aggregate("topic_id"),
    error:
      observationErrors.error ?? homeworkErrors.error ?? questionErrors.error,
    pending:
      observationErrors.isPending ||
      homeworkErrors.isPending ||
      questionErrors.isPending,
  };
}
