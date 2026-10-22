// Production service-worker smoke test. Local fictitious Supabase only.
const fs = require("node:fs");
const { spawn, execFileSync } = require("node:child_process");
const { chromium } = require("@playwright/test");
const base = "http://127.0.0.1:4173/pwa-docenti/";
const env = fs.readFileSync(".env.test.local", "utf8");
if (!env.includes("VITE_SUPABASE_URL=http://127.0.0.1:56321"))
  throw Error("Local environment required");
(async () => {
  execFileSync(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "build", "--mode", "test"],
    { stdio: "ignore" },
  );
  const server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      "4173",
    ],
    { stdio: "ignore", windowsHide: true },
  );
  let browser;
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(base)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!ready) throw Error("Preview did not start");
    const manifest = await (await fetch(base + "manifest.webmanifest")).json();
    if (manifest.scope !== "/pwa-docenti/" || manifest.icons.length < 2)
      throw Error("Invalid manifest");
    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const p = await context.newPage();
    p.on("dialog", (d) => d.accept());
    const user = JSON.parse(fs.readFileSync(".local-test/e2e-users.json"))[0];
    await p.goto(base);
    await p.getByLabel("Email", { exact: true }).fill(user.email);
    await p.getByLabel("Password", { exact: true }).fill(user.password);
    await p.getByRole("button", { name: "Entra nel quaderno" }).click();
    await p.getByRole("heading", { name: /Buon/ }).waitFor();
    await p.goto(base + "#/impostazioni");
    await p.getByRole("button", { name: "Abilita e prepara dati" }).click();
    await p
      .getByRole("button", { name: "Rimuovi copia locale" })
      .waitFor({ state: "visible" });
    await p.waitForFunction(() => !document.querySelector("button:disabled"));
    await p.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await p.reload();
    await p.waitForFunction(() => !!navigator.serviceWorker.controller);
    await p.goto(base + "#/osservazioni");
    await p
      .getByRole("button", { name: "Intervento pertinente", exact: true })
      .waitFor();
    await p.screenshot({ path: ".local-test/desktop.png", fullPage: true });
    await context.setOffline(true);
    await p.reload();
    await p.getByRole("heading", { name: "Osservazioni rapide" }).waitFor();
    await p
      .getByRole("button", { name: "Intervento pertinente", exact: true })
      .click();
    await p.getByText("1 in coda", { exact: true }).waitFor();
    await context.setOffline(false);
    await p
      .getByText("Sincronizzato", { exact: true })
      .waitFor({ timeout: 45_000 });
    const urls = await p.evaluate(async () => {
      const result = [];
      for (const key of await caches.keys())
        for (const req of await (await caches.open(key)).keys())
          result.push(req.url);
      return result;
    });
    if (urls.some((u) => /\/auth\/v1|\/rest\/v1/.test(u)))
      throw Error("Personal API response in Cache API");
    console.log(
      "PASS production PWA: manifest, active service worker, offline hard reload, queued observation, resync, static-only Cache API.",
    );
  } finally {
    await browser?.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
