import type { Row } from "../types/model";
import type { DataMap } from "./catalog";
export type ContextFilters = {
  year: string;
  school: string;
  classId: string;
  subject: string;
};
export function inContext(row: Row, data: DataMap, f: ContextFilters) {
  const ta = data.teaching_assignments?.find(
    (x) => x.id === row.teaching_assignment_id,
  );
  const cs = data.class_subjects?.find((x) => x.id === ta?.class_subject_id);
  const c = data.classes?.find((x) => x.id === (row.class_id ?? ta?.class_id));
  return (
    (!f.classId || (row.class_id ?? ta?.class_id) === f.classId) &&
    (!f.subject || cs?.subject_id === f.subject) &&
    (!f.year || c?.school_year_id === f.year) &&
    (!f.school || c?.school_id === f.school)
  );
}
export function currentAssignments(data: DataMap, f: ContextFilters) {
  return (data.teaching_assignments ?? []).filter((t) =>
    inContext({ ...t, teaching_assignment_id: t.id }, data, f),
  );
}
