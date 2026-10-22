import { useQuery } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { useAuth } from "../state/auth";
import type { TeacherOption } from "../domain/teachers";
export function useTeachers(enabled: boolean) {
  const { session, workspace } = useAuth();
  return useQuery({
    queryKey: ["teacher-directory", session?.user.id, workspace],
    enabled: enabled && !!session && !!workspace,
    staleTime: 0,
    retry: false,
    queryFn: async (): Promise<TeacherOption[]> => {
      const { data, error } = await supabase.rpc(
        "workspace_teacher_directory",
        { p_workspace: workspace },
      );
      if (error) throw error;
      return (data ?? []).map((t) => ({
        id: t.user_id,
        name: t.display_name,
        role: t.member_role,
        // Only the current user's own email is authorized by their Auth session.
        email: t.user_id === session?.user.id ? session.user.email : undefined,
      }));
    },
  });
}
