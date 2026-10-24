import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const users = JSON.parse(fs.readFileSync(".local-test/e2e-users.json", "utf8"));
async function localClient() {
  const env = fs.readFileSync(".env.test.local", "utf8");
  const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)![1].trim();
  const c = createClient("http://127.0.0.1:56321", key, {
    auth: { persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({
    email: users[0].email,
    password: users[0].password,
  });
  if (error) throw error;
  return c;
}
async function insert(
  client: Awaited<ReturnType<typeof localClient>>,
  table: string,
  patch: Record<string, unknown>,
) {
  const { data, error } = await client.rpc("sync_mutation", {
    p_table: table,
    p_workspace: users[0].workspace,
    p_id: crypto.randomUUID(),
    p_operation: crypto.randomUUID(),
    p_expected_version: 0,
    p_patch: patch,
  });
  if (error) throw error;
  return data;
}
async function login(page: Page, index = 0) {
  await page.goto("./");
  await page.getByLabel("Email", { exact: true }).fill(users[index].email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(users[index].password);
  await page.getByRole("button", { name: "Entra nel quaderno" }).click();
  await expect(page.getByRole("heading", { name: /Buon/ })).toBeVisible();
}
test("authentication, workspace isolation, real navigation and mobile layout", async ({
  page,
}) => {
  const failures: string[] = [];
  page.on("pageerror", (e) => failures.push(e.message));
  await login(page);
  await page.goto("./#/studenti");
  await expect(
    page.getByRole("link", { name: "Studente", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Fittizio 2", { exact: true })).toHaveCount(0);
  for (const route of [
    "organizzazione",
    "registro",
    "compiti",
    "osservazioni",
    "verifiche",
    "statistiche",
    "impostazioni",
    "sincronizzazione",
    "ai",
  ]) {
    await page.goto("./#/" + route);
    await expect(page.locator("main h1").first()).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./#/osservazioni");
  await expect(
    page.getByRole("heading", { name: "Osservazioni rapide" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: ".local-test/mobile.png", fullPage: true });
  expect(failures).toEqual([]);
});
test("quick descriptive observation is saved without creating a grade", async ({
  page,
}) => {
  await login(page);
  await page.goto("./#/osservazioni");
  await page
    .getByRole("button", { name: "Intervento pertinente", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Modifica salvata" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Intervento pertinente", { exact: true }).last(),
  ).toBeVisible();
});
test("homework and quick assessment persist, proposal requires explicit confirmation", async ({
  page,
}) => {
  await login(page);
  const r = { ...users[0].rows };
  const local = await localClient();
  r.assessments = await insert(local, "assessments", {
    teaching_assignment_id: r.teaching_assignments.id,
    class_id: r.classes.id,
    title: "Prova rapida " + crypto.randomUUID(),
    assessed_on: "2026-10-22",
    kind: "written",
    correction_mode: "quick",
  });
  await insert(local, "assessment_questions", {
    assessment_id: r.assessments.id,
    label: "Quesito di test",
    max_score: 10,
  });
  await page.goto("./#/compiti/" + r.assignments.id);
  await page
    .getByRole("button", { name: "Tutti: Corretto", exact: true })
    .click();
  await expect(page.getByText("Completamento: 100%")).toBeVisible();
  await page.goto("./#/verifiche/" + r.assessments.id);
  await page.reload();
  await page.getByRole("button", { name: "Bene", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Voto finale" }),
  ).toBeVisible();
  await page
    .getByLabel("Categoria", { exact: true })
    .selectOption(r.evaluation_categories.id);
  await page
    .getByLabel("Regola", { exact: true })
    .selectOption(r.evaluation_rules.id);
  await page.getByRole("button", { name: "Calcola e salva bozza" }).click();
  await expect(page.getByLabel("Voto confermato")).toHaveValue("10");
  await page
    .getByRole("button", { name: "Conferma voto", exact: true })
    .click();
  await expect(page.getByText(/Stato: Confermata/)).toBeVisible();
  await page.goto("./#/studenti/" + r.students.id);
  await page.getByRole("button", { name: "Voti e medie", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Registro e storico voti" }),
  ).toBeVisible();
  await expect(
    page.locator("main").getByText("10", { exact: true }).first(),
  ).toBeVisible();
});
test("exports generate real CSV, XLSX and PDF files", async ({ page }) => {
  await login(page);
  await page.goto("./#/studenti");
  page.on("dialog", (d) => d.accept());
  for (const kind of ["csv", "xlsx", "pdf"]) {
    const download = page.waitForEvent("download");
    await page.getByLabel("Esporta dati", { exact: true }).selectOption(kind);
    const file = await download;
    const path = ".local-test/export." + kind;
    await file.saveAs(path);
    const bytes = fs.readFileSync(path);
    expect(bytes.length).toBeGreaterThan(30);
    if (kind === "csv") expect(bytes.toString()).toContain("Fittizio");
    if (kind === "pdf") expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    if (kind === "xlsx") expect(bytes.subarray(0, 2).toString()).toBe("PK");
  }
});
test("offline queue survives navigation, synchronizes, and logout purges personal cache", async ({
  page,
  context,
}) => {
  await login(page);
  page.on("dialog", (d) => d.accept());
  await page.goto("./#/impostazioni");
  await page.getByRole("button", { name: "Abilita e prepara dati" }).click();
  await expect(
    page.getByText("Attiva su questo dispositivo", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Rimuovi copia locale" }),
  ).toBeEnabled();
  await page.goto("./#/osservazioni");
  await expect(
    page
      .getByRole("button", { name: "Richiede supporto", exact: true })
      .first(),
  ).toBeVisible();
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Richiede supporto", exact: true })
    .first()
    .click();
  await expect(page.getByText("1 in coda", { exact: true })).toBeVisible();
  await page.goto("./#/sincronizzazione");
  await expect(page.getByText("In attesa", { exact: true })).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText("Nessuna modifica in attesa")).toBeVisible();
  await page.getByRole("button", { name: "Esci in sicurezza" }).click();
  await expect(
    page.getByRole("button", { name: "Entra nel quaderno" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some((k) => k.startsWith("offline:")),
    ),
  ).toBe(false);
  await login(page, 1);
  await page.goto("./#/osservazioni");
  await expect(
    page.getByText("Richiede supporto", { exact: true }),
  ).toHaveCount(1);
});
test("local public signup remains disabled", async () => {
  const env = fs.readFileSync(".env.test.local", "utf8");
  const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)![1].trim();
  const client = createClient("http://127.0.0.1:56321", key, {
    auth: { persistSession: false },
  });
  const { error } = await client.auth.signUp({
    email: "must-not-register@example.invalid",
    password: "LocalOnly!ShouldFail2026",
  });
  expect(error).toBeTruthy();
});
