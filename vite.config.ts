import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig(({ mode }) => ({
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
        "icon.svg",
        "icon-192.png",
        "icon-512.png",
        "apple-touch-icon.png",
      ],
      manifest: {
        name: "Quaderno Docenti",
        short_name: "Quaderno",
        description: "Il tuo spazio per insegnare",
        lang: "it",
        start_url: "/pwa-docenti/",
        scope: "/pwa-docenti/",
        display: "standalone",
        theme_color: "#164e42",
        background_color: "#f5f5ef",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: "/pwa-docenti/index.html",
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [],
      },
    }),
  ],
  server: { host: "127.0.0.1", port: 5173 },
  build: { chunkSizeWarningLimit: 900 },
}));
