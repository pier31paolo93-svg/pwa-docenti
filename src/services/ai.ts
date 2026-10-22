export type TeachingSupportKind =
  | "error_analysis"
  | "remedial_exercises"
  | "revision_topics"
  | "student_comment";
export type TeachingSupportResult = { available: false; message: string };
// Deliberately closed adapter: no student payload, provider, or outbound invocation.
// The existing ai-suggestions Edge Function also returns disabled. Activation is
// a separate backend/privacy change, never a client-side switch.
export async function requestTeachingSupport(
  _kind: TeachingSupportKind,
): Promise<TeachingSupportResult> {
  return {
    available: false,
    message:
      "Le funzioni AI non sono configurate. Nessun dato è stato inviato.",
  };
}
