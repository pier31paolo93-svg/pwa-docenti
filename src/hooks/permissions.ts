import { useAuth } from "../state/auth";
import { useData } from "../state/data";
import { catalog } from "../domain/catalog";
import type { Row, TableName } from "../types/model";
import { useCapabilities } from "./capabilities";
export function usePermissions() {
  const { session, role } = useAuth();
  const { data } = useData();
  const capabilities = useCapabilities();
  function writable(table: TableName, row?: Row) {
    if (
      !session ||
      !role ||
      role === "viewer" ||
      !capabilities.data?.extendedHomework
    )
      return false;
    if (catalog[table]?.admin && role !== "owner" && role !== "admin")
      return false;
    if (row?.visibility === "private" && row.created_by !== session.user.id)
      return false;
    if (role === "owner" || role === "admin") return true;
    if (row && row.created_by !== session.user.id) return false;
    if (row?.teaching_assignment_id)
      return (
        data.teaching_assignments?.some(
          (t) =>
            t.id === row.teaching_assignment_id &&
            t.teacher_id === session.user.id,
        ) ?? false
      );
    return true;
  }
  return { writable, admin: role === "owner" || role === "admin" };
}
