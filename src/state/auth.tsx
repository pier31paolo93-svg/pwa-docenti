import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { purge, consent, seal, unseal } from "../offline/vault";
import { stopSync, queue } from "../offline/sync";
import type { Role, Row } from "../types/model";
type Identity = { workspaces: Row[]; members: Row[]; profile: Row | null };
type AuthValue = {
  session: Session | null;
  loading: boolean;
  identity: Identity;
  workspace: string;
  role: Role | null;
  error: string;
  setWorkspace: (id: string) => void;
  reload: () => Promise<void>;
  logout: () => Promise<void>;
};
const empty: Identity = { workspaces: [], members: [], profile: null };
const Context = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [identity, setIdentity] = useState<Identity>(empty);
  const [workspace, choose] = useState("");
  const [error, setError] = useState("");
  const qc = useQueryClient();
  const generation = useRef(0);
  async function load(s: Session | null) {
    const run = ++generation.current;
    setError("");
    if (!s) {
      setIdentity(empty);
      choose("");
      setLoading(false);
      return;
    }
    try {
      let identity: Identity;
      if (!navigator.onLine) {
        if ((s.expires_at ?? 0) * 1000 < Date.now())
          throw new Error("Sessione scaduta. Riconnettiti per accedere.");
        identity =
          (await unseal<Identity>(s.user.id, s.user.id + "|identity")) ?? empty;
      } else {
        const [w, m, p] = await Promise.all([
          supabase.from("workspaces").select("*"),
          supabase
            .from("workspace_members")
            .select("*")
            .eq("user_id", s.user.id)
            .is("revoked_at", null),
          supabase
            .from("profiles")
            .select("*")
            .eq("id", s.user.id)
            .maybeSingle(),
        ]);
        if (w.error || m.error || p.error) throw w.error ?? m.error ?? p.error;
        identity = {
          workspaces: w.data as Row[],
          members: (m.data ?? []).map((r) => ({
            ...r,
            id: r.user_id,
          })) as Row[],
          profile: p.data as Row | null,
        };
        if (consent(s.user.id))
          await seal(s.user.id, s.user.id + "|identity", identity);
      }
      if (run !== generation.current) return;
      setIdentity(identity);
      const saved = localStorage.getItem("workspace:" + s.user.id);
      const personal = identity.workspaces.find(
        (w) => w.owner_id === s.user.id,
      )?.id;
      choose((old) =>
        identity.workspaces.some((w) => w.id === (old || saved))
          ? old || saved!
          : (personal ?? identity.workspaces[0]?.id ?? ""),
      );
    } catch (e) {
      if (run === generation.current)
        setError(
          e instanceof Error ? e.message : "Impossibile caricare il workspace.",
        );
    } finally {
      if (run === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        void load(data.session);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!active) return;
      setSession(s);
      if (_event === "PASSWORD_RECOVERY")
        window.location.hash = "/impostazioni";
      if (_event === "SIGNED_OUT") {
        generation.current++;
        stopSync();
        qc.clear();
        setIdentity(empty);
        choose("");
      }
      // Fetching in the callback can deadlock the Auth client.
      window.setTimeout(() => {
        if (active) void load(s);
      }, 0);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
    // Auth client is stable for the lifetime of the application.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const refresh = () => {
      void load(session);
    };
    window.addEventListener("online", refresh);
    return () => window.removeEventListener("online", refresh);
  }, [session]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (
        session &&
        !navigator.onLine &&
        (session.expires_at ?? 0) * 1000 < Date.now()
      ) {
        generation.current++;
        stopSync();
        qc.clear();
        setIdentity(empty);
        choose("");
        setSession(null);
      }
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [session, qc]);
  const setWorkspace = (id: string) => {
    if (!identity.workspaces.some((w) => w.id === id)) return;
    void qc.cancelQueries();
    qc.removeQueries({ queryKey: ["data"] });
    stopSync();
    choose(id);
    if (session) localStorage.setItem("workspace:" + session.user.id, id);
  };
  const logout = async () => {
    if (
      session &&
      (await queue(session.user.id)).length &&
      !window.confirm(
        "Ci sono modifiche non sincronizzate. Uscendo saranno eliminate da questo dispositivo. Vuoi uscire comunque?",
      )
    )
      return;
    generation.current++;
    stopSync();
    await qc.cancelQueries();
    qc.clear();
    if (session) {
      await purge(session.user.id);
      for (const key of Object.keys(localStorage))
        if (
          key === "workspace:" + session.user.id ||
          key.startsWith("filters:" + session.user.id) ||
          key.startsWith("quick:" + session.user.id)
        )
          localStorage.removeItem(key);
    }
    await supabase.auth.signOut({ scope: "local" });
    setSession(null);
    setIdentity(empty);
    choose("");
  };
  const member = identity.members.find((m) => m.workspace_id === workspace);
  const role = (member?.role ?? null) as Role | null;
  return (
    <Context.Provider
      value={{
        session,
        loading,
        identity,
        workspace,
        role,
        error,
        setWorkspace,
        reload: () => load(session),
        logout,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("AuthProvider mancante");
  return value;
}
