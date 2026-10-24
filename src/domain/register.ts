import type { Row } from "../types/model";
import type { DataMap } from "./catalog";
export type RegisterOrder = "register" | "surname" | "name";
export function firstRegisterNumber(rows: Row[], classId: string) {
  const used = new Set(
    rows
      .filter((e) => e.class_id === classId && !e.deleted_at)
      .map((e) => Number(e.register_number)),
  );
  let n = 1;
  while (used.has(n)) n++;
  return n;
}
export function orderedEnrollments(
  rows: Row[],
  data: DataMap,
  order: RegisterOrder = "register",
) {
  const student = (e: Row) => data.students?.find((s) => s.id === e.student_id);
  const compare = (a: unknown, b: unknown) =>
    String(a ?? "").localeCompare(String(b ?? ""), "it", {
      sensitivity: "base",
      numeric: true,
    });
  return [...rows].sort((a, b) => {
    const sa = student(a),
      sb = student(b);
    const number = (e: Row) =>
      Number(e.register_number) > 0
        ? Number(e.register_number)
        : Number.MAX_SAFE_INTEGER;
    return (
      (order === "register" ? number(a) - number(b) : 0) ||
      (order === "name" ? compare(sa?.first_name, sb?.first_name) : 0) ||
      compare(sa?.last_name, sb?.last_name) ||
      compare(sa?.first_name, sb?.first_name) ||
      compare(a.student_id, b.student_id) ||
      compare(a.id, b.id)
    );
  });
}
export function enrollmentCandidates(data: DataMap, classId: string) {
  const selected = data.classes?.find((c) => c.id === classId);
  if (!selected?.school_year_id || selected.deleted_at) return [];
  const sameYear = new Set(
    data.classes
      ?.filter(
        (c) =>
          c.school_year_id === selected.school_year_id &&
          c.workspace_id === selected.workspace_id,
      )
      .map((c) => c.id),
  );
  const enrolled = new Set(
    data.enrollments
      ?.filter(
        (e) =>
          e.class_id === classId ||
          (!e.deleted_at && sameYear.has(String(e.class_id))),
      )
      .map((e) => e.student_id),
  );
  return (data.students ?? [])
    .filter((s) => !s.deleted_at && !s.archived_at && !enrolled.has(s.id))
    .sort(
      (a, b) =>
        String(a.last_name).localeCompare(String(b.last_name), "it") ||
        String(a.first_name).localeCompare(String(b.first_name), "it") ||
        a.id.localeCompare(b.id),
    );
}
export function studentClassLabel(
  student: string,
  data: DataMap,
  year = "",
  classId = "",
) {
  const classes = new Map(
    (data.classes ?? []).filter((c) => !c.deleted_at).map((c) => [c.id, c]),
  );
  const selectedYear = year || classes.get(classId)?.school_year_id;
  const enrollments = (data.enrollments ?? []).filter((e) => {
    const cls = classes.get(String(e.class_id));
    return (
      e.student_id === student &&
      !e.deleted_at &&
      cls &&
      (!selectedYear || cls.school_year_id === selectedYear)
    );
  });
  const scoped = selectedYear
    ? enrollments
    : (() => {
        const latest = studentEnrollment(student, { ...data, enrollments });
        const latestYear = classes.get(
          String(latest?.class_id),
        )?.school_year_id;
        return enrollments.filter(
          (e) => classes.get(String(e.class_id))?.school_year_id === latestYear,
        );
      })();
  return [
    ...new Set(
      scoped.map((e) => String(classes.get(String(e.class_id))!.name)),
    ),
  ]
    .sort()
    .join(", ");
}
export function nextClassName(name: string, repeat = false) {
  const m = name.match(/^(\s*)([1-5])([ªa°.]?)(.*)$/i);
  if (!m) return "";
  const n = Number(m[2]) + (repeat ? 0 : 1);
  return n > 5 ? "" : `${m[1]}${n}${m[3]}${m[4]}`;
}
export function studentEnrollment(
  student: string,
  data: DataMap,
  classId = "",
) {
  return (data.enrollments ?? [])
    .filter(
      (e) =>
        e.student_id === student &&
        !e.deleted_at &&
        (!classId || e.class_id === classId),
    )
    .sort((a, b) => {
      const yearEnd = (e: Row) =>
        String(
          data.school_years?.find(
            (y) =>
              y.id ===
              data.classes?.find((c) => c.id === e.class_id)?.school_year_id,
          )?.ends_on ?? "",
        );
      return yearEnd(b).localeCompare(yearEnd(a)) || a.id.localeCompare(b.id);
    })[0];
}
export function orderedStudents(
  rows: Row[],
  data: DataMap,
  order: RegisterOrder = "register",
  classId = "",
) {
  const synthetic = rows.map(
    (s) =>
      ({
        id: s.id,
        student_id: s.id,
        register_number: studentEnrollment(s.id, data, classId)
          ?.register_number,
      }) as Row,
  );
  const positions = new Map(
    orderedEnrollments(synthetic, { ...data, students: rows }, order).map(
      (e, i) => [e.id, i],
    ),
  );
  return [...rows].sort(
    (a, b) => (positions.get(a.id) ?? 0) - (positions.get(b.id) ?? 0),
  );
}
