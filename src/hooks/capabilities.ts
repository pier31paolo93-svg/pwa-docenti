import { useQuery } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { useAuth } from "../state/auth";
import { consent, seal, unseal } from "../offline/vault";
export type Capabilities = { extendedHomework: boolean };
export const capabilityKey = (owner: string, workspace: string) =>
  owner + "|" + workspace + "|capabilities";
export function useCapabilities() {
  const { session, workspace } = useAuth();
  return useQuery({
    queryKey: ["capabilities", session?.user.id, workspace],
    enabled: !!session && !!workspace,
    queryFn: async () => {
      const owner = session!.user.id;
      const key = capabilityKey(owner, workspace);
      if (!navigator.onLine)
        return (
          (await unseal<Capabilities>(owner, key)) ?? {
            extendedHomework: false,
          }
        );
      const { error } = await supabase
        .from("homework_checks")
        .select("excused")
        .eq("workspace_id", workspace)
        .limit(0);
      if (error && !["42703", "PGRST204"].includes(error.code)) throw error;
      const result = { extendedHomework: !error };
      if (consent(owner)) await seal(owner, key, result);
      return result;
    },
    staleTime: 300_000,
    retry: false,
    networkMode: "always",
  });
}
