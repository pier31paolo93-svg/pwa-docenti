import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig(({ mode, command }) => {
  if (command === "build" && mode === "production") {
    const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
    if (env.VITE_SUPABASE_URL !== "https://mwabfmooefmkszlrymyx.supabase.co")
      throw new Error(
        "Production build requires the authorized Supabase project URL.",
      );
    if (
      !/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(
        env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
      )
    )
      throw new Error("Production build requires a Supabase publishable key.");
    const allowed = new Set([
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_PUBLISHABLE_KEY",
    ]);
    if (
      Object.keys(env).some(
        (key) => key.startsWith("VITE_") && !allowed.has(key),
      )
    )
      throw new Error(
        "Only the two approved public frontend variables are allowed.",
      );
  }
  return {
    cacheDir: ".local-test/vite-" + mode,
    optimizeDeps: {
      include: ["papaparse", "exceljs", "jspdf", "jspdf-autotable"],
    },
    base: "/pwa-docenti/",
    plugins: [
      react(),
      tailwind(),
      VitePWA({
        registerType: "prompt",
        includeAssets: [
          "favicon.ico",
          "favicon-32.png",
          "favicon-16.png",
          "icon-maskable-512.png",
          "icon-192.png",
          "icon-512.png",
          "apple-touch-icon.png",
        ],
        manifest: {
          name: "Quaderno Docenti",
          short_name: "Quaderno",
          description: "Il tuo spazio per insegnare",
          lang: "it",
          id: "/pwa-docenti/",
          start_url: "/pwa-docenti/",
          scope: "/pwa-docenti/",
          display: "standalone",
          theme_color: "#1d4ed8",
          background_color: "#f4f7fc",
          icons: [
            { src: "icon-192.png", sizes: "192x192", type: "image/png" },
            {
              src: "icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "icon-maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          navigateFallback: "/pwa-docenti/index.html",
          globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2}"],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          runtimeCaching: [],
        },
      }),
    ],
    server: { host: "127.0.0.1", port: 5173 },
    build: { chunkSizeWarningLimit: 900 },
  };
});
