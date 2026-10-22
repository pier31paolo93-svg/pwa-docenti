import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const configured = !!url && !!key && key.startsWith("sb_publishable_");
export const supabase = createClient<Database>(
  url || "https://not-configured.supabase.co",
  configured ? key! : "sb_publishable_not_configured",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  },
);
export const recoveryUrl = () =>
  window.location.origin + import.meta.env.BASE_URL;
