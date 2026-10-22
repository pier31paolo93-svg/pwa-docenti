// Configuration evaluation only: no API calls, credentials or emitted bundle.
import assert from "node:assert/strict";
import { loadConfigFromFile } from "vite";
const saved = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith("VITE_")));
const fixture = {
  VITE_SUPABASE_URL: "https://mwabfmooefmkszlrymyx.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_configuration_test_only",
};
function setEnv(values) {
  for (const key of Object.keys(process.env)) if (key.startsWith("VITE_")) delete process.env[key];
  Object.assign(process.env, values);
}
try {
  setEnv(fixture);
  assert(await loadConfigFromFile({ command: "build", mode: "production" }, "vite.config.ts"));
  const invalid = [
    { VITE_SUPABASE_URL: "https://wrong-project.supabase.co" },
    { VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_rejected_test_value" },
    { VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_setup" },
    { VITE_SERVICE_ROLE_KEY: "rejected_test_value" },
  ];
  for (const values of invalid) {
    setEnv({ ...fixture, ...values });
    await assert.rejects(() => loadConfigFromFile({ command: "build", mode: "production" }, "vite.config.ts"));
  }
  console.log("PASS 5 production configuration checks: approved public variables accepted; wrong project, secret key, placeholder and extra frontend variable rejected.");
} finally {
  setEnv(saved);
}
