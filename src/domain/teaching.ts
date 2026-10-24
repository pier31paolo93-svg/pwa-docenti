import { gridSummary, type Grid } from "./grids";
import { text, type Row } from "../types/model";
import type { DataMap } from "./catalog";
import { inContext, type ContextFilters } from "./context";
export const romeDay = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Rome",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(value));
export function dayShift(day: string, n: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function calendarRange(day: string, mode: string) {
  if (mode === "day") return [day, day];
  if (mode === "week") {
    const weekday = new Date(day + "T12:00:00Z").getUTCDay();
    const first = dayShift(day, -((weekday + 6) % 7));
    return [first, dayShift(first, 6)];
  }
  return [
    day.slice(0, 7) + "-01",
    dayShift(
      day.slice(0, 7) + "-01",
      new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0).getDate() -
        1,
    ),
  ];
}
export type TeachingEvent = {
  id: string;
  kind: string;
  day: string;
  title: string;
  route: string;
  row: Row;
  time?: string;
};
export function teachingEvents(
  data: DataMap,
  filters: ContextFilters,
  recovery: Row[] = [],
): TeachingEvent[] {
  const events: TeachingEvent[] = [
    ...(data.lessons ?? [])
      .filter((r) => inContext(r, data, filters))
      .map((r) => ({
        id: r.id,
        kind: "lesson",
        day: romeDay(text(r, "starts_at")),
        title: text(r, "title"),
        time: new Intl.DateTimeFormat("it-IT", {
          timeZone: "Europe/Rome",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(text(r, "starts_at"))),
        route: "/registro/" + r.id,
        row: r,
      })),
    ...(data.assessments ?? [])
      .filter((r) => inContext(r, data, filters))
      .map((r) => ({
        id: r.id,
        kind: r.kind === "oral" ? "oral" : "assessment",
        day: text(r, "assessed_on"),
        title: text(r, "title"),
        route: "/verifiche/" + r.id,
        row: r,
      })),
    ...(data.assignments ?? [])
      .filter((r) => inContext(r, data, filters))
      .map((r) => ({
        id: r.id,
        kind: "homework",
        day: text(r, "due_on"),
        title: text(r, "title"),
        route: "/compiti/" + r.id,
        row: r,
      })),
    ...recovery
      .filter((r) => !r.deleted_at && r.due_on && inContext(r, data, filters))
      .map((r) => ({
        id: r.id,
        kind: "recovery",
        day: text(r, "due_on"),
        title: text(r, "title"),
        route: "/recupero?activity=" + r.id,
        row: r,
      })),
  ];
  return events
    .filter((r) => !r.row.deleted_at)
    .sort(
      (a, b) =>
        a.day.localeCompare(b.day) ||
        (a.time ?? "").localeCompare(b.time ?? "") ||
        a.id.localeCompare(b.id),
    );
}
export function confirmedStatistics(rows: Row[], passMark = 6) {
  const values = rows
      .filter(
        (r) =>
          r.status === "confirmed" &&
          !r.deleted_at &&
          r.confirmed_value != null &&
          Number.isFinite(Number(r.confirmed_value)),
      )
      .map((r) => Number(r.confirmed_value))
      .sort((a, b) => a - b),
    n = values.length;
  return {
    count: n,
    mean: n ? values.reduce((a, b) => a + b, 0) / n : null,
    median: n
      ? (values[Math.floor(n / 2)] + values[Math.ceil(n / 2) - 1]) / 2
      : null,
    minimum: n ? values[0] : null,
    maximum: n ? values[n - 1] : null,
    passPercent: n
      ? (values.filter((v) => v >= passMark).length / n) * 100
      : null,
    small: n < 3,
    distribution: [...new Set(values.map(Math.floor))].map((v) => ({
      grade: v,
      count: values.filter((x) => Math.floor(x) === v).length,
    })),
  };
}
export function assessmentProgress(
  assessment: Row,
  enrollment: Row,
  data: DataMap,
) {
  const result = data.assessment_results?.find(
    (r) =>
      r.assessment_id === assessment.id && r.enrollment_id === enrollment.id,
  );
  if (!result) return "uncorrected";
  if (result.attendance === "absent") return "absent";
  const grade = data.grade_entries?.find(
    (g) => g.assessment_result_id === result.id && g.status === "confirmed",
  );
  if (grade) return "confirmed";
  if (assessment.grid_snapshot)
    return gridSummary(
      assessment.grid_snapshot as Grid,
      data.question_results ?? [],
      result.id,
    ).complete
      ? "draft"
      : "incomplete";
  const questions = (data.assessment_questions ?? []).filter(
      (q) => q.assessment_id === assessment.id,
    ),
    leaves = questions.filter(
      (q) => !questions.some((child) => child.parent_question_id === q.id),
    );
  return leaves.length &&
    leaves.every((q) =>
      data.question_results?.some(
        (r) =>
          r.question_id === q.id &&
          r.assessment_result_id === result.id &&
          r.score != null,
      ),
    )
    ? "draft"
    : "incomplete";
}
export function changedFields(old: Row | undefined, next: Row) {
  return Object.keys(next).filter(
    (k) =>
      ![
        "id",
        "workspace_id",
        "created_by",
        "created_at",
        "updated_at",
        "version",
        "visibility",
      ].includes(k) &&
      JSON.stringify(old?.[k] ?? null) !== JSON.stringify(next[k] ?? null),
  );
}
