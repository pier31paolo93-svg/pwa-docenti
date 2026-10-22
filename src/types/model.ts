import type { Database, Json } from "./database";
export type TableName = keyof Database["public"]["Tables"];
export type ViewName = keyof Database["public"]["Views"];
export type SourceName = TableName | ViewName;
export type Row = {
  id: string;
  workspace_id?: string;
  created_by?: string;
  version?: number;
  deleted_at?: string | null;
  [key: string]: unknown;
};
export type Patch = Record<string, Json | undefined>;
export type Role = "owner" | "admin" | "teacher" | "viewer";
export const text = (
  r: Record<string, unknown> | undefined,
  k: string,
): string => (r?.[k] == null ? "" : String(r[k]));
export const number = (
  r: Record<string, unknown> | undefined,
  k: string,
): number => Number(r?.[k] ?? 0);
export const today = (): string => new Date().toLocaleDateString("sv-SE");
export function message(error: unknown): string {
  if (error && typeof error === "object" && "message" in error)
    return String(error.message);
  return String(error);
}
export function code(error: unknown): string {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "";
}
