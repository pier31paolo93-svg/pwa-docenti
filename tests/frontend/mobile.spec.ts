import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const user = JSON.parse(
  fs.readFileSync(".local-test/e2e-users.json", "utf8"),
)[0];
async function login(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Entra nel quaderno" }).click();
  await expect(page.getByRole("heading", { name: /Buon/ })).toBeVisible();
}
async function local() {
  const env = fs.readFileSync(".env.test.local", "utf8");
  if (!env.includes("VITE_SUPABASE_URL=http://127.0.0.1:56321"))
    throw Error("Local fixtures only");
  const c = createClient(
    "http://127.0.0.1:56321",
    env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)![1].trim(),
    { auth: { persistSession: false } },
  );
  const { error } = await c.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw error;
  return c;
}
async function add(
  c: Awaited<ReturnType<typeof local>>,
  table: string,
  patch: Record<string, unknown>,
) {
  const { data, error } = await c.rpc("sync_mutation", {
    p_table: table,
    p_workspace: user.workspace,
    p_id: crypto.randomUUID(),
    p_operation: crypto.randomUUID(),
    p_expected_version: 0,
    p_patch: patch,
  });
  if (error) throw error;
  return data;
}
test("mobile navigation has five destinations, accessible menu and no overflow in dark/text zoom", async ({
  page,
}) => {
  await login(page);
  const nav = page.locator(".bottom-nav");
  await expect(nav.locator("a,button")).toHaveCount(5);
  await expect(nav).toContainText("HomeClassiRegistroValutazioniAltro");
  await nav.getByRole("button", { name: "Altro" }).click();
  await expect(
    page.getByRole("dialog", { name: "Menu completo" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(nav.getByRole("button", { name: "Altro" })).toBeFocused();
  for (const width of [320, 360, 375, 390, 430, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("./#/organizzazione");
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
      document.documentElement.style.fontSize = "200%";
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
});
test("fullscreen editor keeps actions visible, validates, guards dirty changes and restores focus", async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 320, height: 430 });
  await page.goto("./#/studenti");
  const create = page.getByRole("button", {
    name: "Nuovo studente",
    exact: true,
  });
  await create.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading")).toBeFocused();
  await dialog
    .getByRole("button", { name: "Crea studente", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Nome *", { exact: true }).fill("Fittizio mobile");
  const footer = await dialog.locator(".modal-footer").boundingBox();
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(431);
  page.once("dialog", (d) => d.dismiss());
  await dialog.getByRole("button", { name: "Annulla", exact: true }).click();
  await expect(dialog).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(create).toBeFocused();
});
test("mobile cards create, edit, archive and restore a fictitious student", async ({
  page,
}) => {
  await login(page);
  await page.goto("./#/studenti");
  const code = "MOBILE-" + crypto.randomUUID();
  await page
    .getByRole("button", { name: "Nuovo studente", exact: true })
    .click();
  await page.getByLabel("Nome *", { exact: true }).fill("Mobile");
  await page.getByLabel("Cognome *", { exact: true }).fill("Fittizio");
  await page.getByLabel("Codice locale *", { exact: true }).fill(code);
  await page
    .getByRole("button", { name: "Crea studente", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Cerca nell’elenco" }).fill(code);
  const card = page.locator(".resource-mobile").filter({ hasText: code });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Modifica", exact: true }).click();
  await page.getByLabel("Nome *", { exact: true }).fill("Mobile corretto");
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(card).toContainText("Mobile corretto");
  await card.getByText("Altri dettagli e azioni", { exact: true }).click();
  page.on("dialog", (d) => d.accept());
  await card.getByRole("button", { name: "Archivia", exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.getByLabel("Includi archiviati").check();
  await expect(card).toBeVisible();
  await card.getByText("Altri dettagli e azioni", { exact: true }).click();
  await card.getByRole("button", { name: "Ripristina", exact: true }).click();
  await page.getByLabel("Includi archiviati").uncheck();
  await expect(card).toBeVisible();
});

test("mobile editor retains dirty changes when Back is cancelled and closes on confirmed Back", async ({
  page,
}) => {
  await login(page);
  await page.goto("./#/organizzazione");
  await page.goto("./#/studenti");
  await page
    .getByRole("button", { name: "Nuovo studente", exact: true })
    .click();
  await page
    .getByLabel("Nome *", { exact: true })
    .fill("Bozza fittizia non salvata");
  page.once("dialog", (d) => d.dismiss());
  await page.goBack();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Nome *", { exact: true })).toHaveValue(
    "Bozza fittizia non salvata",
  );
  page.once("dialog", (d) => d.accept());
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Organizza il quaderno", exact: true }),
  ).toBeVisible();
});
test("mobile rapid observation saves and corrects the same row", async ({
  page,
}) => {
  await login(page);
  await page.goto("./#/osservazioni");
  await page
    .getByRole("button", { name: "Intervento pertinente", exact: true })
    .click();
  await expect(page.getByLabel("Testo ultima osservazione")).toHaveValue(
    "Intervento pertinente",
  );
  await page
    .getByLabel("Testo ultima osservazione")
    .fill("Nota interamente fittizia corretta");
  await page.getByRole("button", { name: "Salva correzione" }).click();
  await expect(
    page.getByText("Osservazione corretta e salvata.", { exact: true }),
  ).toBeVisible();
  const c = await local();
  const { data, error } = await c
    .from("observations")
    .select("notes")
    .eq("workspace_id", user.workspace)
    .eq("notes", "Nota interamente fittizia corretta");
  expect(error).toBeNull();
  expect(data!.length).toBeGreaterThan(0);
});
test("mobile quick assessment progresses one question at a time and reviews before confirming", async ({
  page,
}) => {
  const c = await local();
  const assessment = await add(c, "assessments", {
    teaching_assignment_id: user.rows.teaching_assignments.id,
    class_id: user.rows.classes.id,
    title: "Mobile fittizio " + crypto.randomUUID(),
    assessed_on: "2026-10-22",
    kind: "written",
    correction_mode: "quick",
  });
  for (const name of ["Primo quesito mobile", "Secondo quesito mobile"])
    await add(c, "assessment_questions", {
      assessment_id: assessment.id,
      label: name,
      max_score: 10,
    });
  await login(page);
  await page.goto("./#/verifiche/" + assessment.id);
  await expect(page.locator(".correction-row")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Non risposto", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Bene", exact: true }).click();
  await page
    .getByRole("button", { name: "Quesito successivo", exact: true })
    .click();
  await page.getByRole("button", { name: "Così così", exact: true }).click();
  await expect(
    page.getByText("Correzione completa", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Categoria", { exact: true })
    .selectOption(user.rows.evaluation_categories.id);
  await page
    .getByLabel("Regola", { exact: true })
    .selectOption(user.rows.evaluation_rules.id);
  await page.getByRole("button", { name: "Calcola e salva bozza" }).click();
  await expect(page.getByLabel("Voto confermato")).not.toHaveValue("");
  await page
    .getByRole("button", { name: "Conferma voto", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Riepilogo prima della conferma" }),
  ).toBeVisible();
  await expect(page.getByText(/Stato: Bozza/)).toBeVisible();
  await page
    .getByRole("button", { name: "Conferma definitiva", exact: true })
    .click();
  await expect(page.getByText(/Stato: Confermata/)).toBeVisible();
});
test("mobile homework counters update and last outcome can be restored", async ({
  page,
}) => {
  await login(page);
  await page.goto("./#/compiti/" + user.rows.assignments.id);
  await page
    .getByRole("button", { name: "Tutti: Corretto", exact: true })
    .click();
  await expect(page.getByText("Completamento: 100%")).toBeVisible();
  await page
    .getByRole("button", { name: "Tutti: Non svolto", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ripristina ultimo esercizio", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Ripristina ultimo esercizio",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("mobile organization editors validate, create and update schools, years, subjects and classes", async ({
  page,
}) => {
  await login(page);
  const suffix = crypto.randomUUID().slice(0, 8);
  const cases = [
    {
      resource: "school_years",
      singular: "anno scolastico",
      name: "Anno scolastico *",
      values: {
        "Anno scolastico *": "Mobile " + suffix,
        "Inizio *": "2026-09-01",
        "Fine *": "2027-08-31",
      },
    },
    {
      resource: "schools",
      singular: "scuola",
      name: "Nome della scuola *",
      values: {
        "Nome della scuola *": "Scuola fittizia " + suffix,
        "Codice scuola *": "MS-" + suffix,
      },
    },
    {
      resource: "subjects",
      singular: "materia",
      name: "Nome della materia *",
      values: {
        "Nome della materia *": "Materia fittizia " + suffix,
        "Codice *": "MM-" + suffix,
      },
    },
    {
      resource: "classes",
      singular: "classe",
      name: "Nome classe *",
      values: { "Nome classe *": "Classe fittizia " + suffix },
    },
  ];
  for (const item of cases) {
    await page.goto("./#/archivio/" + item.resource);
    await page.locator(".page-heading button").click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: "Crea " + item.singular, exact: true })
      .click();
    await expect(dialog.locator(".field-error").first()).toBeVisible();
    for (const [name, value] of Object.entries(item.values))
      await dialog.getByLabel(name, { exact: true }).fill(value);
    if (item.resource === "classes") {
      await dialog
        .getByLabel("Scuola *", { exact: true })
        .selectOption(user.rows.schools.id);
      await dialog
        .getByLabel("Anno scolastico *", { exact: true })
        .selectOption(user.rows.school_years.id);
    }
    await dialog
      .getByRole("button", { name: "Crea " + item.singular, exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await page
      .getByRole("searchbox", { name: "Cerca nell’elenco" })
      .fill(suffix);
    const card = page.locator(".resource-mobile").filter({ hasText: suffix });
    await expect(card).toHaveCount(1);
    await card.getByRole("button", { name: "Modifica", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByLabel(item.name, { exact: true })
      .fill("Corretto " + suffix);
    await page.getByRole("button", { name: "Salva modifiche" }).click();
    await expect(card).toContainText("Corretto " + suffix);
  }
});

test("mobile lesson, homework and assessment editors create, edit and open details", async ({
  page,
}) => {
  await login(page);
  const suffix = crypto.randomUUID().slice(0, 8);
  for (const item of [
    {
      resource: "lessons",
      singular: "lezione",
      name: "Argomento della lezione *",
      dates: { "Inizio *": "2026-10-22T08:00", "Fine *": "2026-10-22T09:00" },
    },
    {
      resource: "assignments",
      singular: "consegna",
      name: "Titolo *",
      dates: { "Assegnato il *": "2026-10-22", "Scadenza *": "2026-10-23" },
    },
    {
      resource: "assessments",
      singular: "prova",
      name: "Titolo *",
      dates: { "Data *": "2026-10-22" },
    },
  ]) {
    await page.goto("./#/archivio/" + item.resource);
    await page.locator(".page-heading button").click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("combobox", { name: /Classe e materia/ })
      .selectOption(user.rows.teaching_assignments.id);
    await dialog
      .getByLabel(item.name, { exact: true })
      .fill("Fittizio mobile " + suffix);
    for (const [name, value] of Object.entries(item.dates))
      await dialog.getByLabel(name, { exact: true }).fill(value);
    await dialog
      .getByRole("button", { name: "Crea " + item.singular, exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await page
      .getByRole("searchbox", { name: "Cerca nell’elenco" })
      .fill(suffix);
    const card = page.locator(".resource-mobile").filter({ hasText: suffix });
    await card.getByRole("button", { name: "Modifica", exact: true }).click();
    await dialog
      .getByLabel(item.name, { exact: true })
      .fill("Corretto mobile " + suffix);
    await dialog.getByRole("button", { name: "Salva modifiche" }).click();
    await expect(dialog).toHaveCount(0);
    await card
      .getByRole("link", { name: "Apri dettaglio", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Corretto mobile " + suffix,
        exact: true,
      }),
    ).toBeVisible();
  }
});
