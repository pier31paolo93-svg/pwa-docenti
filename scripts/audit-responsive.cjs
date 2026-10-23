// Read-only UI audit using fictitious users on the local Supabase stack only.
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { chromium, webkit } = require("@playwright/test");
const stage = process.argv[2] || "after";
const widths = [320, 375, 390, 768, 820, 834, 1024, 1180];
const base = "http://127.0.0.1:5182/pwa-docenti/";
const root = `.local-test/mobile-audit/${stage}`;
fs.mkdirSync(root, { recursive: true });
const source = fs
  .readFileSync("src/domain/catalog.ts", "utf8")
  .split("export const catalog")[1]
  .split("export type DataMap")[0];
const resources = [...source.matchAll(/^  ([a-z_]+): \{$/gm)].map((m) => m[1]);
const titles = Object.fromEntries(
  [...source.matchAll(/^  ([a-z_]+): \{\s*title: "([^"]+)"/gm)].map((m) => [
    m[1],
    m[2],
  ]),
);
const users = JSON.parse(fs.readFileSync(".local-test/e2e-users.json", "utf8"));
if (
  !fs
    .readFileSync(".env.test.local", "utf8")
    .includes("VITE_SUPABASE_URL=http://127.0.0.1:56321")
)
  throw Error("Local test configuration required");
(async () => {
  const server = spawn(
    process.execPath,
    ['--input-type=module','-e',"const {createServer}=await import('vite');const s=await createServer({mode:'test',server:{host:'127.0.0.1',port:5182,strictPort:true,watch:null,hmr:false}});await s.listen();"],
    { stdio: "ignore", windowsHide: true },
  );
  let browser;
  try {
    for (let i = 0; i < 80; i++) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    browser = await (
      process.argv.includes("--webkit") ? webkit : chromium
    ).launch();
    const context = await browser.newContext();
    context.setDefaultTimeout(60000);
    const page = await context.newPage();
    page.on("dialog", (d) => d.accept());
    await page.goto(base);
    await page.getByLabel("Email", { exact: true }).fill(users[0].email);
    await page.getByLabel("Password", { exact: true }).fill(users[0].password);
    await page.getByRole("button", { name: "Entra nel quaderno" }).click();
    await page.getByRole("heading", { name: /Buon/ }).waitFor();
    const results = [];
    async function measure(route, form = false) {
      const metrics = await page.evaluate(() => {
        const visible = (e) =>
          !!e.getClientRects().length &&
          getComputedStyle(e).visibility !== "hidden";
        const dialog = document.querySelector("dialog[open]");
        const inputs = [
          ...(dialog || document).querySelectorAll(
            "input:not([type=checkbox]),select,textarea",
          ),
        ].filter(visible);
        const targets = [...(dialog || document).querySelectorAll("button,a")]
          .filter(visible)
          .filter((e) => !e.closest(".sidebar:not(.open)"));
        return {
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          dialogWidth: dialog?.getBoundingClientRect().width,
          narrowFields: inputs.filter(
            (e) => e.getBoundingClientRect().width < 140,
          ).length,
          narrowNames: inputs
            .filter((e) => e.getBoundingClientRect().width < 140)
            .map((e) => ({
              label: e.getAttribute("aria-label") || e.outerHTML.slice(0, 160),
              width: e.getBoundingClientRect().width,
            })),
          smallNames: targets
            .filter((e) => {
              const r = e.getBoundingClientRect();
              return r.width < 44 || r.height < 44;
            })
            .map((e) => ({
              text: e.getAttribute("aria-label") || e.textContent.slice(0, 60),
              class: e.className,
              width: e.getBoundingClientRect().width,
              height: e.getBoundingClientRect().height,
            })),
          smallTargets: targets.filter((e) => {
            const r = e.getBoundingClientRect();
            return r.width < 44 || r.height < 44;
          }).length,
          dialogFits:
            !dialog ||
            (dialog.getBoundingClientRect().right <= innerWidth + 1 &&
              dialog.getBoundingClientRect().left >= -1),
        };
      });
      results.push({
        width: page.viewportSize().width,
        route,
        form,
        ...metrics,
      });
    }
    for (const width of widths) {
      await page.setViewportSize({ width, height: 844 });
      const routes = [
        "",
        "organizzazione",
        "passaggio-anno",
        "griglie",
        "registro",
        "compiti",
        "verifiche",
        "osservazioni",
        "studenti",
        "statistiche",
        "importa",
        "impostazioni",
        "sincronizzazione",
        "ai",
      ];
      for (const route of routes) {
        await page.goto(base + "#/" + route);
        await page.locator("main").waitFor();
        await page.getByRole("heading", { level: 1 }).first().waitFor();
        await measure(route);
        if (
          [
            "",
            "organizzazione",
            "osservazioni",
            "registro",
            "passaggio-anno",
            "griglie",
          ].includes(route)
        )
          await page.screenshot({
            path: `${root}/${width}-${route || "home"}.png`,
            fullPage: true,
          });
      }
      for (const resource of resources) {
        await page.goto(base + "#/archivio/" + resource);
        await page
          .getByRole("heading", {
            level: 1,
            name: titles[resource],
            exact: true,
          })
          .waitFor();
        await measure(resource);
        const create = page.locator(".page-heading button").first();
        if (await create.isVisible()) {
          await create.click();
          await page.getByRole("dialog").waitFor();
          await measure(resource, true);
          if (
            [
              "classes",
              "students",
              "assessments",
              "observations",
              "teaching_assignments",
            ].includes(resource)
          )
            await page.screenshot({
              path: `${root}/${width}-form-${resource}.png`,
            });
          await page
            .getByRole("button", { name: "Chiudi", exact: true })
            .click();
        }
      }
      await page.goto(base + "#/griglie");
      await page
        .getByRole("button", { name: "Crea griglia universale personalizzata" })
        .click();
      for (let step = 0; step < 4; step++) {
        await measure("griglie/wizard/" + step, true);
        await page.screenshot({
          path: `${root}/${width}-griglia-${step}.png`,
          fullPage: true,
        });
        if (step < 3)
          await page
            .getByRole("button", { name: "Continua", exact: true })
            .click();
      }
      await page.getByRole("button", { name: "Chiudi editor griglia" }).click();
      await page.goto(base + "#/passaggio-anno");
      await page
        .getByLabel("Anno di origine", { exact: true })
        .selectOption({ label: "2026/2027 test" });
      await page
        .locator("main")
        .getByLabel("Scuola", { exact: true })
        .selectOption({ label: "Scuola fittizia E2E" });
      for (let step = 1; step <= 3; step++) {
        await page
          .getByRole("button", {
            name: step === 3 ? "Verifica anteprima" : "Continua",
            exact: true,
          })
          .click();
        if (step === 3)
          await page
            .getByRole("heading", { name: "Anteprima verificata dal server" })
            .waitFor();
        await measure("passaggio-anno/wizard/" + step, true);
        await page.screenshot({
          path: `${root}/${width}-anno-${step}.png`,
          fullPage: true,
        });
      }
      console.log(`AUDIT ${stage} ${width}px complete`);
    }
    fs.writeFileSync(`${root}/report.json`, JSON.stringify(results, null, 2));
    console.log(
      JSON.stringify({
        stage,
        resources: resources.length,
        screens: results.length,
        overflow: results.filter((r) => r.overflow).length,
        narrowFields: results.reduce((n, r) => n + r.narrowFields, 0),
        smallTargets: results.reduce((n, r) => n + r.smallTargets, 0),
        clippedDialogs: results.filter((r) => !r.dialogFits).length,
      }),
    );
    if (
      process.argv.includes("--assert") &&
      results.some(
        (r) => r.overflow || !r.dialogFits || r.narrowFields || r.smallTargets,
      )
    )
      throw Error("Responsive geometry violations");
  } finally {
    await browser?.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
