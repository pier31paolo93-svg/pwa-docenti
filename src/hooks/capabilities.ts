import { useQuery } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { useAuth } from "../state/auth";
import { consent, seal, unseal } from "../offline/vault";
export type Capabilities = {
  dailyRegister?: boolean;
  recovery?: boolean;
  advancedImport?: boolean;
  extendedHomework: boolean;
  registerNumbers?: boolean;
  yearTransition?: boolean;
  universalGrids?: boolean;
};
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
      const probes = await Promise.all([
        supabase
          .from("enrollments")
          .select("register_number")
          .eq("workspace_id", workspace)
          .limit(0),
        supabase
          .from("year_transitions")
          .select("id")
          .eq("workspace_id", workspace)
          .limit(0),
        supabase
          .from("assessments")
          .select("grid_snapshot")
          .eq("workspace_id", workspace)
          .limit(0),
        supabase
          .from("observations")
          .select("daily_lesson_id")
          .eq("workspace_id", workspace)
          .limit(0),
        supabase
          .from("recovery_activities")
          .select("id")
          .eq("workspace_id", workspace)
          .limit(0),
        supabase
          .from("import_batches")
          .select("source_fingerprint")
          .eq("workspace_id", workspace)
          .limit(0),
      ]);
      for (const p of probes)
        if (
          p.error &&
          !["42703", "42P01", "PGRST204", "PGRST205"].includes(p.error.code)
        )
          throw p.error;
      const result = {
        extendedHomework: !error,
        registerNumbers: !probes[0].error,
        yearTransition: !probes[1].error,
        universalGrids: !probes[2].error,
        dailyRegister: !probes[3].error,
        recovery: !probes[4].error,
        advancedImport: !probes[5].error,
      };
      if (consent(owner)) await seal(owner, key, result);
      return result;
    },
    staleTime: 300_000,
    retry: false,
    networkMode: "always",
  });
}
