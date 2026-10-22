import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
const user = JSON.parse(
  fs.readFileSync(".local-test/e2e-users.json", "utf8"),
)[0];
async function login(page: Page) {
  await page.goto("./");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Entra nel quaderno" }).click();
  await expect(page.getByRole("heading", { name: /Buon/ })).toBeVisible();
}
async function client() {
  const env = fs.readFileSync(".env.test.local", "utf8");
  const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)![1].trim();
  const c = createClient("http://127.0.0.1:56321", key, {
    auth: { persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw error;
  return c;
}
async function add(
  c: Awaited<ReturnType<typeof client>>,
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
test("backoffice creates, edits, archives and restores a student", async ({
  page,
}) => {
  await login(page);
  await page.goto("./#/studenti");
  const code = "UI-" + crypto.randomUUID();
  await page
    .getByRole("button", { name: "Nuovo studente", exact: true })
    .click();
  await page.getByLabel("Nome *", { exact: true }).fill("Inserimento");
  await page.getByLabel("Cognome *", { exact: true }).fill("Fittizio UI");
  await page.getByLabel("Codice locale *", { exact: true }).fill(code);
  await page
    .getByRole("button", { name: "Crea studente", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const row = page.getByRole("row").filter({ hasText: code });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Modifica", exact: true }).click();
  await page.getByLabel("Nome *", { exact: true }).fill("Modificato");
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(row).toContainText("Modificato");
  page.on("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "Archivia", exact: true }).click();
  await expect(row).toHaveCount(0);
  await page.getByLabel("Includi archiviati").check();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Archivia", exact: true }).click();
  await page.getByLabel("Includi archiviati").uncheck();
  await expect(row).toBeVisible();
});
test("CSV and XLSX imports validate duplicates and apply only chosen rows", async ({
  page,
}) => {
  await login(page);
  page.on("dialog", (d) => d.accept());
  for (const ext of ["csv", "xlsx"]) {
    const code = "IMPORT-" + crypto.randomUUID();
    const records = [
      ["Nome", "Cognome", "Codice"],
      ["Importato", "Fittizio", code],
      ["Duplicato", "Fittizio", user.rows.students.external_code],
    ];
    const file = ".local-test/import." + ext;
    if (ext === "csv")
      fs.writeFileSync(file, records.map((r) => r.join(",")).join("\n"));
    else {
      const b = new ExcelJS.Workbook();
      b.addWorksheet("Studenti").addRows(records);
      await b.xlsx.writeFile(file);
    }
    await page.goto("./#/importa");
    await page.getByLabel("File CSV o XLSX").setInputFiles(file);
    await page.getByRole("button", { name: "Genera anteprima server" }).click();
    await expect(
      page.getByText('["duplicate_external_code"]', { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Decisione riga 1", { exact: true })
      .selectOption("insert");
    await expect(
      page.getByLabel("Decisione riga 2", { exact: true }),
    ).toBeEnabled();
    await page
      .getByLabel("Decisione riga 2", { exact: true })
      .selectOption("skip");
    await page.getByRole("button", { name: "Applica importazione" }).click();
    await expect(
      page.getByRole("heading", { name: "Iscrivi gli studenti importati" }),
    ).toBeVisible();
    await page.goto("./#/studenti");
    await page.getByRole("searchbox", { name: "Cerca nell’elenco" }).fill(code);
    await expect(page.getByRole("row").filter({ hasText: code })).toBeVisible();
  }
});
test("analytic written and rubric oral corrections use server proposals", async ({
  page,
}) => {
  const c = await client();
  await login(page);
  for (const mode of ["analytic", "rubric"]) {
    let rubric;
    let criterion;
    if (mode === "rubric") {
      rubric = await add(c, "assessment_rubrics", {
        name: "Rubrica fittizia " + crypto.randomUUID(),
      });
      criterion = await add(c, "rubric_criteria", {
        rubric_id: rubric.id,
        label: "Ragionamento test",
        weight: 2,
        max_score: 5,
        levels: [
          { label: "In acquisizione", score: 1 },
          { label: "Acquisito", score: 5 },
        ],
      });
    }
    const assessment = await add(c, "assessments", {
      teaching_assignment_id: user.rows.teaching_assignments.id,
      class_id: user.rows.classes.id,
      title: "Correzione " + mode,
      assessed_on: "2026-10-22",
      kind: mode === "rubric" ? "oral" : "written",
      correction_mode: mode,
      rubric_id: rubric?.id ?? null,
    });
    if (mode === "analytic")
      await add(c, "assessment_questions", {
        assessment_id: assessment.id,
        label: "Punti analitici test",
        max_score: 10,
      });
    await page.goto("./#/verifiche/" + assessment.id);
    await page.reload(); // Server-side fixture created after this browser loaded its workspace.
    const score = page.locator("main input[type=number]").first();
    await score.fill(mode === "rubric" ? "5" : "8");
    await score.blur();
    await expect(
      page.getByRole("heading", { name: "Voto finale" }),
    ).toBeVisible();
    await page
      .getByLabel("Categoria", { exact: true })
      .selectOption(user.rows.evaluation_categories.id);
    await page
      .getByLabel("Regola", { exact: true })
      .selectOption(user.rows.evaluation_rules.id);
    await page.getByRole("button", { name: "Calcola e salva bozza" }).click();
    await expect(page.getByLabel("Voto confermato")).toHaveValue(
      mode === "rubric" ? "10" : "8.2",
    );
    await page
      .getByRole("button", { name: "Conferma voto", exact: true })
      .click();
    await expect(page.getByText(/Stato: Confermata/)).toBeVisible();
    expect(criterion?.max_score ?? 10).toBe(mode === "rubric" ? 5 : 10);
  }
});
test("offline stale edit becomes an explicit conflict and can retain remote values", async ({
  page,
  context,
}) => {
  const c = await client();
  const original = await add(c, "students", {
    first_name: "Originale",
    last_name: "Conflitto fittizio",
    external_code: "CONFLICT-" + crypto.randomUUID(),
  });
  await login(page);
  page.on("dialog", (d) => d.accept());
  await page.goto("./#/impostazioni");
  await page.getByRole("button", { name: "Abilita e prepara dati" }).click();
  await expect(
    page.getByRole("button", { name: "Rimuovi copia locale" }),
  ).toBeEnabled();
  await page.goto("./#/studenti");
  await page
    .getByRole("searchbox", { name: "Cerca nell’elenco" })
    .fill(original.external_code);
  const row = page.getByRole("row").filter({ hasText: original.external_code });
  await row.getByRole("button", { name: "Modifica", exact: true }).click();
  await context.setOffline(true);
  await page.getByLabel("Nome *", { exact: true }).fill("Locale fittizio");
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page.getByText("1 in coda", { exact: true })).toBeVisible();
  const { error } = await c.rpc("sync_mutation", {
    p_table: "students",
    p_workspace: user.workspace,
    p_id: original.id,
    p_operation: crypto.randomUUID(),
    p_expected_version: original.version,
    p_patch: { first_name: "Remoto fittizio" },
  });
  if (error) throw error;
  await context.setOffline(false);
  await page.goto("./#/sincronizzazione");
  await expect(page.getByText("Conflitto", { exact: true })).toBeVisible();
  await expect(
    page.getByText('"Remoto fittizio"', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Usa dati remoti e scarta le modifiche a questa riga",
    })
    .click();
  await expect(page.getByText("Nessuna modifica in attesa")).toBeVisible();
  await page.goto("./#/studenti");
  await page
    .getByRole("searchbox", { name: "Cerca nell’elenco" })
    .fill(original.external_code);
  await expect(
    page.getByRole("row").filter({ hasText: original.external_code }),
  ).toContainText("Remoto fittizio");
});
