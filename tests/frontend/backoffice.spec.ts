import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const users = JSON.parse(fs.readFileSync(".local-test/e2e-users.json", "utf8"));
async function login(page: Page) {
  await page.goto("./");
  await page.getByLabel("Email", { exact: true }).fill(users[0].email);
  await page.getByLabel("Password", { exact: true }).fill(users[0].password);
  await page.getByRole("button", { name: "Entra nel quaderno" }).click();
  await expect(page.getByRole("heading", { name: /Buon/ })).toBeVisible();
}
const titles = [
  "Anni scolastici",
  "Scuole",
  "Materie",
  "Classi",
  "Classi / Materie",
  "Assegnazioni docenti",
  "Studenti",
  "Iscrizioni",
];
for (const [device, width, height] of [
  ["desktop", 1440, 1000],
  ["tablet", 820, 1180],
  ["smartphone", 390, 844],
] as const) {
  test(`organization order and navigation on ${device}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await login(page);
    await page.goto("./#/organizzazione");
    const section = page
      .locator("section")
      .filter({
        has: page.getByRole("heading", { name: "Organizzazione", exact: true }),
      });
    await expect(section.getByRole("link")).toHaveText(titles);
    for (const title of titles) {
      await section.getByRole("link", { name: title, exact: true }).click();
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      await page.goto("./#/organizzazione");
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}
test("searchable authorized teacher selection persists UUID without exposing other workspace identities", async ({
  page,
}) => {
  const env = fs.readFileSync(".env.test.local", "utf8");
  const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)![1].trim();
  const c = createClient("http://127.0.0.1:56321", key, {
    auth: { persistSession: false },
  });
  const { error: loginError } = await c.auth.signInWithPassword({
    email: users[0].email,
    password: users[0].password,
  });
  if (loginError) throw loginError;
  const { data: directory, error } = await c.rpc(
    "workspace_teacher_directory",
    { p_workspace: users[0].workspace },
  );
  if (error) throw error;
  expect(
    directory.some((t: { user_id: string }) => t.user_id === users[1].id),
  ).toBe(false);
  expect(directory.every((t: Record<string, unknown>) => !("email" in t))).toBe(
    true,
  );
  const denied = await c.rpc("workspace_teacher_directory", {
    p_workspace: users[1].workspace,
  });
  expect(denied.error?.code).toBe("42501");
  async function add(table: string, patch: Record<string, unknown>) {
    const { data, error } = await c.rpc("frontend_sync_mutation", {
      p_operation: crypto.randomUUID(),
      p_table: table,
      p_id: crypto.randomUUID(),
      p_workspace: users[0].workspace,
      p_expected_version: 0,
      p_patch: patch,
    });
    if (error) throw error;
    return data;
  }
  const code = "DOCENTE-" + crypto.randomUUID();
  const subject = await add("subjects", { name: code, code });
  const cs = await add("class_subjects", {
    class_id: users[0].rows.classes.id,
    subject_id: subject.id,
  });
  await login(page);
  await page.goto("./#/archivio/teaching_assignments");
  await page
    .getByRole("button", { name: "Nuova assegnazione", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: /^Classe \/ materia \*/ })
    .selectOption(cs.id);
  await page.getByLabel("Cerca docente per nome o email").fill(users[0].email);
  const teacher = page.getByLabel("Docente *", { exact: true });
  await expect(teacher).toContainText(users[0].email);
  await expect(teacher).not.toContainText(users[1].email);
  await expect(teacher).not.toContainText(users[0].id);
  await teacher.selectOption(users[0].id);
  await page
    .getByRole("button", { name: "Crea assegnazione", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const row = page.getByRole("row").filter({ hasText: code });
  await expect(row).toContainText("Docente fittizio 1");
  const saved = await c
    .from("teaching_assignments")
    .select("teacher_id")
    .eq("class_subject_id", cs.id)
    .single();
  expect(saved.data?.teacher_id).toBe(users[0].id);
  await row.getByRole("button", { name: "Modifica", exact: true }).click();
  await expect(page.getByLabel("Docente *", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Docente *", { exact: true })).toHaveValue(
    users[0].id,
  );
  await c.auth.signOut();
});
test("missing cloud migration blocks only new teacher selection and preserves existing references", async ({
  page,
}) => {
  await page.route("**/rest/v1/rpc/workspace_teacher_directory", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        code: "PGRST202",
        message: "Function not yet deployed",
      }),
    }),
  );
  await login(page);
  await page.goto("./#/archivio/teaching_assignments");
  await page
    .getByRole("button", { name: "Nuova assegnazione", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Elenco docenti non disponibile",
  );
  await expect(
    page.getByRole("button", { name: "Crea assegnazione", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Annulla", exact: true }).click();
  await page
    .getByRole("button", { name: "Modifica", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Docente *", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Salva modifiche" }),
  ).toBeEnabled();
});
