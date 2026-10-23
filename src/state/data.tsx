import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth";
import {
  fetchRows,
  configureSync,
  flush,
  save,
  syncEvents,
  queue,
  stopSync,
} from "../offline/sync";
import { consent } from "../offline/vault";
import { orderedEnrollments, orderedStudents } from "../domain/register";
import type { Row, SourceName, TableName, Patch } from "../types/model";
import type { DataMap } from "../domain/catalog";
import { Spinner, ErrorBox } from "../components/ui";
export function useRows(source: SourceName, enabled = true) {
  const { session, workspace } = useAuth();
  return useQuery({
    queryKey: ["data", session?.user.id, workspace, source],
    queryFn: () => fetchRows(source, session!.user.id, workspace),
    enabled: !!session && !!workspace && enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
    networkMode: "always",
  });
}
type Filters = {
  year: string;
  school: string;
  classId: string;
  subject: string;
};
type DataValue = {
  data: DataMap;
  filters: Filters;
  setFilters: (p: Partial<Filters>) => void;
  save: (table: TableName, patch: Patch, existing?: Row) => Promise<Row>;
  notice: (text: string) => void;
  online: boolean;
};
const Context = createContext<DataValue | null>(null);
export const baseTables: TableName[] = [
  "school_years",
  "schools",
  "subjects",
  "classes",
  "students",
  "enrollments",
  "class_subjects",
  "teaching_assignments",
  "topics",
  "competencies",
  "evaluation_categories",
  "evaluation_rules",
  "observation_types",
  "error_types",
  "assessment_rubrics",
  "rubric_criteria",
  "lessons",
  "assignments",
  "assignment_exercises",
  "homework_checks",
  "homework_exercise_results",
  "assessments",
  "assessment_questions",
  "assessment_results",
  "question_results",
  "rubric_scores",
  "observations",
  "grade_entries",
];
export function DataProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const [online, setOnline] = useState(navigator.onLine);
  const queries = useQueries({
    queries: baseTables.map((source) => ({
      queryKey: ["data", auth.session?.user.id, auth.workspace, source],
      queryFn: () => fetchRows(source, auth.session!.user.id, auth.workspace),
      enabled: !!auth.session && !!auth.workspace,
      staleTime: 60_000,
      retry: 1,
      networkMode: "always" as const,
    })),
  });
  const signature = queries.map((q) => q.dataUpdatedAt).join(",");
  const data = useMemo(() => {
    const map = Object.fromEntries(
      baseTables.map((t, i) => [
        t,
        (queries[i].data ?? []).filter((r) => !r.deleted_at),
      ]),
    ) as DataMap;
    map.enrollments = orderedEnrollments(map.enrollments ?? [], map);
    map.students = orderedStudents(map.students ?? [], map);
    return map;
  }, [signature, auth.workspace]);
  const [toast, setToast] = useState("");
  const [filters, set] = useState<Filters>(() => {
    try {
      return (
        JSON.parse(
          localStorage.getItem(
            "filters:" + auth.session?.user.id + ":" + auth.workspace,
          ) || "null",
        ) ?? { year: "", school: "", classId: "", subject: "" }
      );
    } catch {
      return { year: "", school: "", classId: "", subject: "" };
    }
  });
  useEffect(() => {
    if (!auth.session) return;
    configureSync(auth.session.user.id, auth.workspace, () => {
      void qc.invalidateQueries({ queryKey: ["data"] });
    });
    const check = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine)
        void flush(auth.session!.user.id).catch((e) => setToast(String(e)));
    };
    window.addEventListener("online", check);
    window.addEventListener("offline", check);
    const timer = window.setInterval(check, 30_000);
    check();
    return () => {
      window.removeEventListener("online", check);
      window.removeEventListener("offline", check);
      window.clearInterval(timer);
      stopSync();
    };
  }, [auth.session?.user.id, auth.workspace, qc]);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 6000);
    return () => window.clearTimeout(t);
  }, [toast]);
  const setFilters = (p: Partial<Filters>) =>
    set((old) => {
      const next = { ...old, ...p };
      if ("year" in p || "school" in p) next.classId = "";
      localStorage.setItem(
        "filters:" + auth.session!.user.id + ":" + auth.workspace,
        JSON.stringify(next),
      );
      return next;
    });
  const doSave = async (table: TableName, patch: Patch, existing?: Row) => {
    if (!auth.session || !auth.workspace || auth.role === "viewer")
      throw new Error("Operazione non consentita.");
    const row = await save(
      table,
      auth.workspace,
      auth.session.user.id,
      patch,
      existing,
    );
    const pending = (await queue(auth.session.user.id)).some(
      (op) => op.id === row.id && op.workspace === auth.workspace,
    );
    setToast(
      pending
        ? "Salvato sul dispositivo: sincronizzazione in attesa."
        : "Modifica salvata.",
    );
    void qc.invalidateQueries({ queryKey: ["data"] });
    return row;
  };
  return (
    <Context.Provider
      value={{
        data,
        filters,
        setFilters,
        save: doSave,
        notice: setToast,
        online,
      }}
    >
      {queries.some((q) => q.isPending) ? (
        <Spinner />
      ) : (
        <>
          <ErrorBox error={queries.find((q) => q.error)?.error} />
          {children}
        </>
      )}
      <div className="toast" role="status" aria-live="polite">
        {toast}
      </div>
    </Context.Provider>
  );
}
export function useData() {
  const c = useContext(Context);
  if (!c) throw new Error("DataProvider mancante");
  return c;
}
export function useSyncState() {
  useSyncExternalStore(syncEvents.subscribe, syncEvents.snapshot);
  const { session } = useAuth();
  const [ops, setOps] = useState<Awaited<ReturnType<typeof queue>>>([]);
  useEffect(() => {
    if (session && consent(session.user.id))
      void queue(session.user.id).then(setOps);
    else setOps([]);
  }, [session, syncEvents.snapshot()]);
  return ops;
}
