import { supabase } from "./supabase";
import type { SourceName, TableName, Row, Patch } from "../types/model";
import type { Json } from "../types/database";
type Query = PromiseLike<{ data: unknown; error: unknown }> & {
  select: (columns: string) => Query;
  eq: (column: string, value: string) => Query;
  order: (column: string, options: { ascending: boolean }) => Query;
  limit: (count: number) => Query;
  range: (start: number, end: number) => Query;
  gt: (column: string, value: string) => Query;
  maybeSingle: () => Query;
};
// Runtime table names are checked by the catalog; RPC payloads remain generated types.
const dynamic = supabase as unknown as { from: (source: SourceName) => Query };
export async function pull(
  source: SourceName,
  workspace: string,
): Promise<Row[]> {
  const all: Row[] = [];
  let cursor = "";
  for (;;) {
    let query = dynamic
      .from(source)
      .select("*")
      .eq("workspace_id", workspace)
      .order("id", { ascending: true })
      .limit(1000);
    // Views without a UUID key are small aggregated projections and use range pagination.
    const view = source.startsWith("v_");
    if (view) {
      const dimensions: Record<string, string[]> = {
        v_grade_register: ["id"],
        v_student_averages: [
          "student_id",
          "subject_id",
          "school_year_id",
          "category_id",
        ],
        v_grade_progression: [
          "student_id",
          "subject_id",
          "school_year_id",
          "graded_on",
        ],
        v_homework_summary: ["homework_check_id"],
        v_homework_completion: ["id"],
        v_observation_history: ["id"],
        v_assessment_history: ["id"],
        v_recurring_errors: ["enrollment_id", "error_type_id"],
        v_competency_progress: ["enrollment_id", "competency_id"],
        v_class_dashboard: ["class_id", "subject_id", "school_year_id"],
        v_subject_dashboard: ["subject_id", "school_year_id"],
      };
      query = dynamic
        .from(source)
        .select("*")
        .eq("workspace_id", workspace)
        .range(all.length, all.length + 999);
      for (const key of dimensions[source] ?? [])
        query = query.order(key, { ascending: true });
    } else if (cursor) query = query.gt("id", cursor);
    const { data, error } = await query;
    if (error) throw error;
    const page = (data ?? []) as unknown as Row[];
    all.push(...page);
    if (page.length < 1000) break;
    if (!view) cursor = page[page.length - 1].id;
  }
  return all;
}
export async function mutate(
  table: TableName,
  workspace: string,
  id: string,
  expected: number,
  patch: Patch,
  operation: string = crypto.randomUUID(),
): Promise<Row> {
  const { data, error } = await supabase.rpc("frontend_sync_mutation", {
    p_operation: operation,
    p_table: table,
    p_id: id,
    p_workspace: workspace,
    p_expected_version: expected,
    p_patch: patch as Json,
  });
  if (error) {
    if (error.code === "PGRST202")
      throw new Error(
        "Per salvare è necessaria la migrazione frontend 18, da autorizzare sul cloud.",
      );
    throw error;
  }
  return data as unknown as Row;
}
export async function current(
  table: TableName,
  workspace: string,
  id: string,
): Promise<Row | null> {
  const { data, error } = await dynamic
    .from(table)
    .select("*")
    .eq("workspace_id", workspace)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Row | null;
}
export const active = (rows: Row[]) => rows.filter((r) => !r.deleted_at);
