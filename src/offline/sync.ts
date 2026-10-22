import type { Row, TableName, Patch, SourceName } from "../types/model";
import { code, message } from "../types/model";
import { mutate, current, pull } from "../services/api";
import { supabase } from "../services/supabase";
import { consent, purge, seal, unseal } from "./vault";
export type Operation = {
  operation: string;
  id: string;
  table: TableName;
  workspace: string;
  expected: number;
  patch: Patch;
  state: "pending" | "conflict" | "error";
  error?: string;
  remote?: Row | null;
  created: number;
};
let revision = 0;
const listeners = new Set<() => void>();
export const syncEvents = {
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  snapshot: () => revision,
};
function emit() {
  revision++;
  listeners.forEach((fn) => fn());
}
let running = false;
let currentOwner = "";
let currentWorkspace = "";
let invalidate = () => {};
let retryTimer: ReturnType<typeof setTimeout> | undefined;
const queueKey = (owner: string) => owner + "|queue";
const cacheKey = (owner: string, workspace: string, table: SourceName) =>
  owner + "|" + workspace + "|" + table;
export function configureSync(
  owner: string,
  workspace: string,
  notify: () => void,
) {
  currentOwner = owner;
  currentWorkspace = workspace;
  invalidate = notify;
}
export async function queue(owner = currentOwner): Promise<Operation[]> {
  return (await unseal<Operation[]>(owner, queueKey(owner))) ?? [];
}
let queueMutex: Promise<unknown> = Promise.resolve();
function editQueue<T>(
  owner: string,
  fn: (ops: Operation[]) => Promise<T>,
): Promise<T> {
  const work = async () => fn(await queue(owner));
  const result = queueMutex.then(() =>
    navigator.locks
      ? navigator.locks.request("quaderno-queue:" + owner, work)
      : work(),
  );
  queueMutex = result.catch(() => {});
  return result;
}
async function persistQueue(owner: string, ops: Operation[]) {
  if (!consent(owner)) return;
  await seal(owner, queueKey(owner), ops, Number.MAX_SAFE_INTEGER);
  emit();
}
async function ensureSession(owner: string) {
  const { data } = await supabase.auth.getSession();
  if (
    !data.session ||
    data.session.user.id !== owner ||
    (data.session.expires_at ?? 0) * 1000 < Date.now()
  )
    throw new Error(
      "Sessione scaduta: accedi online prima di consultare o sincronizzare i dati.",
    );
}
export async function fetchRows(
  source: SourceName,
  owner: string,
  workspace: string,
): Promise<Row[]> {
  await ensureSession(owner);
  if (!navigator.onLine) {
    if (!consent(owner))
      throw new Error("Offline non abilitato su questo dispositivo.");
    const cached = await unseal<Row[]>(
      owner,
      cacheKey(owner, workspace, source),
    );
    if (!cached)
      throw new Error(
        "Dati non ancora disponibili offline: apri questa pagina quando sei online.",
      );
    return overlay(cached, await queue(owner), source, workspace);
  }
  const rows = await pull(source, workspace);
  if (consent(owner))
    await seal(owner, cacheKey(owner, workspace, source), rows);
  return overlay(rows, await queue(owner), source, workspace);
}
export function overlay(
  rows: Row[],
  ops: Operation[],
  source: string,
  workspace: string,
): Row[] {
  const map = new Map(rows.map((r) => [r.id, r]));
  for (const op of ops.filter(
    (x) => x.table === source && x.workspace === workspace,
  )) {
    const existing = map.get(op.id);
    map.set(op.id, {
      ...existing,
      ...op.patch,
      id: op.id,
      workspace_id: workspace,
      version: op.expected + 1,
    } as Row);
  }
  return [...map.values()];
}
export async function save(
  table: TableName,
  workspace: string,
  owner: string,
  patch: Patch,
  existing?: Row,
): Promise<Row> {
  await ensureSession(owner);
  const id = existing?.id ?? crypto.randomUUID();
  const expected = existing?.version ?? 0;
  if (!consent(owner)) {
    if (!navigator.onLine)
      throw new Error(
        "Abilita prima la modalità offline nelle impostazioni del dispositivo.",
      );
    const result = await mutate(table, workspace, id, expected, patch);
    invalidate();
    return result;
  }
  const op: Operation = {
    operation: crypto.randomUUID(),
    table,
    id,
    workspace,
    expected,
    patch,
    state: "pending",
    created: Date.now(),
  };
  await editQueue(owner, async (ops) => {
    ops.push(op);
    await persistQueue(owner, ops);
  });
  const optimistic = {
    ...existing,
    ...patch,
    id,
    workspace_id: workspace,
    created_by: existing?.created_by ?? owner,
    version: expected + 1,
  } as Row;
  const key = cacheKey(owner, workspace, table);
  const rows = (await unseal<Row[]>(owner, key)) ?? [];
  await seal(owner, key, overlay(rows, [op], table, workspace));
  invalidate();
  if (navigator.onLine) await flush(owner);
  const remaining = (await queue(owner)).find(
    (x) => x.operation === op.operation,
  );
  if (remaining?.state === "error" || remaining?.state === "conflict")
    throw new Error(remaining.error);
  if (!remaining) {
    const persisted = await unseal<Row[]>(owner, key);
    return persisted?.find((r) => r.id === id) ?? optimistic;
  }
  return optimistic;
}
export async function flush(owner = currentOwner): Promise<void> {
  if (running || !navigator.onLine || !owner) return;
  running = true;
  emit();
  try {
    await ensureSession(owner);
    for (;;) {
      const ops = await queue(owner);
      const op = ops.find((x) => x.workspace === currentWorkspace);
      if (!op || op.state !== "pending" || owner !== currentOwner) break;
      try {
        const result = await mutate(
          op.table,
          op.workspace,
          op.id,
          op.expected,
          op.patch,
          op.operation,
        );
        if (owner !== currentOwner || !consent(owner)) break;
        await editQueue(owner, async (latest) =>
          persistQueue(
            owner,
            latest.filter((x) => x.operation !== op.operation),
          ),
        );
        const key = cacheKey(owner, op.workspace, op.table);
        const cached = (await unseal<Row[]>(owner, key)) ?? [];
        const rows = new Map(cached.map((r) => [r.id, r]));
        if ((rows.get(result.id)?.version ?? 0) <= (result.version ?? 0))
          rows.set(result.id, result);
        await seal(owner, key, [...rows.values()]);
        invalidate();
      } catch (error) {
        if (
          !navigator.onLine ||
          error instanceof TypeError ||
          (!code(error) &&
            /failed to fetch|networkerror|load failed/i.test(message(error)))
        ) {
          if (navigator.onLine && owner === currentOwner) {
            clearTimeout(retryTimer);
            retryTimer = setTimeout(() => {
              void flush(owner).catch(() => {});
            }, 2000);
          }
          break;
        }
        const conflict = ["40001", "PT409"].includes(code(error));
        let remote: Row | null = null;
        if (conflict)
          try {
            remote = await current(op.table, op.workspace, op.id);
          } catch {
            /* Access may have been revoked. */
          }
        await editQueue(owner, async (latest) =>
          persistQueue(
            owner,
            latest.map((x) =>
              x.operation === op.operation
                ? {
                    ...x,
                    state: conflict ? "conflict" : "error",
                    error: message(error),
                    remote,
                  }
                : x,
            ),
          ),
        );
        break;
      }
    }
  } finally {
    running = false;
    emit();
  }
}
export async function resolveOperation(
  operation: string,
  action: "remote" | "retry",
  patch?: Patch,
): Promise<void> {
  const owner = currentOwner;
  await ensureSession(owner);
  await editQueue(owner, async (ops) => {
    const op = ops.find((x) => x.operation === operation);
    if (!op) return;
    if (action === "remote") {
      ops = ops.filter(
        (x) =>
          !(
            x.table === op.table &&
            x.id === op.id &&
            x.workspace === op.workspace
          ),
      );
    } else {
      const remote = await current(op.table, op.workspace, op.id);
      ops = ops.map((x) =>
        x.operation === operation
          ? {
              ...x,
              operation: crypto.randomUUID(),
              patch: patch ?? x.patch,
              expected: remote?.version ?? 0,
              state: "pending",
              error: undefined,
              remote: undefined,
            }
          : x,
      );
    }
    await persistQueue(owner, ops);
  });
  invalidate();
  await flush(owner);
}
export async function clearOffline(owner: string) {
  await purge(owner);
  emit();
  invalidate();
}
export const syncing = () => running;
export function stopSync() {
  clearTimeout(retryTimer);
  currentOwner = "";
  currentWorkspace = "";
  invalidate = () => {};
}
