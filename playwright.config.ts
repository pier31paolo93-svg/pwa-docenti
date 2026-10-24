import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/frontend",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:5176/pwa-docenti/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "node --input-type=module -e \"const {createServer}=await import('vite');const server=await createServer({mode:'test',server:{host:'127.0.0.1',port:5176,strictPort:true,watch:null,hmr:false}});await server.listen();\"",
    url: "http://127.0.0.1:5176/pwa-docenti/",
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
