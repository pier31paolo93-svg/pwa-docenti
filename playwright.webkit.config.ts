import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: "timetable.spec.ts",
  outputDir: "test-results/webkit",
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/webkit", open: "never" }],
  ],
  projects: [{ name: "webkit", use: { browserName: "webkit" } }],
});
