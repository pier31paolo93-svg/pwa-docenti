import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const users = JSON.parse(fs.readFileSync(".local-test/e2e-users.json", "utf8"));
const user = users[0];
async function client() {
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
async function login(page: Page) {
  await page.goto("./");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Entra nel quaderno" }).click();
  await expect(page.getByRole("heading", { name: /Buon/ })).toBeVisible();
  page.on("dialog", (d) => d.accept());
}
async function add(
  c: Awaited<ReturnType<typeof client>>,
  table: string,
  patch: Record<string, unknown>,
) {
  const { data, error } = await c.rpc("frontend_sync_mutation", {
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

test("daily register persists canonical homework exceptions and descriptive lesson notes", async ({
  page,
}) => {
  const c = await client();
  const r = user.rows;
  const lesson = await add(c, "lessons", {
    teaching_assignment_id: r.teaching_assignments.id,
    title: "Registro fittizio " + Date.now(),
    starts_at: "2026-10-23T07:00:00Z",
    ends_at: "2026-10-23T08:00:00Z",
  });
  const assignment = await add(c, "assignments", {
    teaching_assignment_id: r.teaching_assignments.id,
    class_id: r.classes.id,
    title: "Compito rapido fittizio " + Date.now(),
    assigned_on: "2026-10-22",
    due_on: "2026-10-23",
  });
  await page.setViewportSize({ width: 834, height: 1194 });
  await login(page);
  await page.goto("./#/registro-rapido");
  await page
    .getByLabel("Classe e materia", { exact: true })
    .selectOption(r.teaching_assignments.id);
  await page.getByLabel("Data lezione", { exact: true }).fill("2026-10-23");
  await page.getByLabel("Lezione del registro rapido").selectOption(lesson.id);
  await page.getByLabel("Compito da controllare").selectOption(assignment.id);
  await page
    .getByRole("button", { name: "Tutti compiti fatti", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Salvato." }),
  ).toBeVisible();
  const pupil = page.locator(".daily-roster > article").first();
  await pupil
    .getByRole("button", { name: "Non controllato", exact: true })
    .click();
  await expect(
    pupil.getByRole("button", { name: "Non controllato", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await pupil.getByLabel("Partecipazione").fill("Intervento fittizio V134");
  await pupil.getByLabel("Osservazione veloce").fill("Nota fittizia V134");
  await pupil
    .getByRole("button", { name: "Salva annotazione", exact: true })
    .click();
  await expect
    .poll(async () => {
      const { data } = await c
        .from("observations")
        .select("mode,notes")
        .eq("daily_lesson_id", lesson.id);
      return data?.[0]?.notes;
    })
    .toBe("Nota fittizia V134");
  const { data: checks } = await c
    .from("v_homework_completion")
    .select("*")
    .eq("assignment_id", assignment.id);
  expect(
    checks?.some(
      (x) =>
        x.completion_status === "unchecked" && x.completed_percent === null,
    ),
  ).toBe(true);
  await page.reload();
  await page
    .getByLabel("Classe e materia", { exact: true })
    .selectOption(r.teaching_assignments.id);
  await page.getByLabel("Data lezione", { exact: true }).fill("2026-10-23");
  await page.getByLabel("Lezione del registro rapido").selectOption(lesson.id);
  await expect(page.locator("textarea").first()).toHaveValue(
    "Nota fittizia V134",
  );
});

test("calendar edits canonical assessments on both iPad orientations", async ({
  page,
}) => {
  const c = await client();
  const a = await add(c, "assessments", {
    teaching_assignment_id: user.rows.teaching_assignments.id,
    class_id: user.rows.classes.id,
    title: "Calendario fittizio " + Date.now(),
    assessed_on: "2026-10-25",
    kind: "oral",
    correction_mode: "quick",
  });
  await login(page);
  await page.goto("./#/calendario");
  await page.getByLabel("Data calendario").fill("2026-10-25");
  for (const size of [
    { width: 834, height: 1194 },
    { width: 1180, height: 820 },
  ]) {
    await page.setViewportSize(size);
    for (const mode of ["day", "week", "month", "list"]) {
      await page.getByLabel("Vista calendario").selectOption(mode);
      await expect(
        page.locator('a[href="#/verifiche/' + a.id + '"]'),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
    }
  }
  const { error } = await c.rpc("frontend_sync_mutation", {
    p_table: "assessments",
    p_workspace: user.workspace,
    p_id: a.id,
    p_operation: crypto.randomUUID(),
    p_expected_version: a.version,
    p_patch: { title: a.title + " modificata" },
  });
  expect(error).toBeNull();
  await page.reload();
  await page.getByLabel("Data calendario").fill("2026-10-25");
  await expect(
    page.getByRole("link", { name: new RegExp(a.title + " modificata") }),
  ).toBeVisible();
});

test("recovery targets appear in student profile and calendar without automatic grades", async ({
  page,
}) => {
  const c = await client();
  const a = await add(c, "recovery_activities", {
    teaching_assignment_id: user.rows.teaching_assignments.id,
    class_id: user.rows.classes.id,
    title: "Recupero fittizio " + Date.now(),
    objective: "Obiettivo fittizio deciso dal docente",
    due_on: "2026-10-29",
    status: "planned",
  });
  await login(page);
  await page.goto("./#/recupero?activity=" + a.id);
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Assegna ai selezionati" }).click();
  await expect(page.getByLabel("Stato del recupero")).toBeVisible();
  await page.getByLabel("Stato del recupero").selectOption("completed");
  await page
    .getByLabel("Esito del recupero")
    .fill("Esercitazione fittizia completata");
  await page
    .getByRole("button", { name: "Salva recupero", exact: true })
    .click();
  await expect
    .poll(async () => {
      const { data } = await c
        .from("recovery_students")
        .select("*")
        .eq("activity_id", a.id);
      return data?.[0]?.outcome;
    })
    .toBe("Esercitazione fittizia completata");
  const { data: targets } = await c
    .from("recovery_students")
    .select("*")
    .eq("activity_id", a.id);
  const { data: enrollment } = await c
    .from("enrollments")
    .select("student_id")
    .eq("id", targets![0].enrollment_id)
    .single();
  await page.goto("./#/studenti/" + enrollment!.student_id);
  await page.getByRole("button", { name: "Recupero", exact: true }).click();
  await expect(page.getByText(a.title, { exact: true })).toBeVisible();
  await page.goto("./#/calendario");
  await page.getByLabel("Data calendario").fill("2026-10-29");
  await expect(
    page.getByRole("link", { name: a.title, exact: true }),
  ).toBeVisible();
});

test("advanced import previews register conflicts and repeated CSV is idempotent", async ({
  page,
}) => {
  await login(page);
  await page.goto("./#/importa-avanzato");
  const code = "V134-UI-" + crypto.randomUUID();
  const file = {
    name: "studenti-fittizi.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Cognome,Nome,Codice studente,Numero di registro\nFittizio,Importato," +
        code +
        ",9999",
    ),
  };
  await page.getByLabel("File da riconciliare").setInputFiles(file);
  await page
    .getByLabel("Classe predefinita")
    .selectOption(user.rows.classes.id);
  await page.getByLabel("Azione riga 1").selectOption("insert");
  const c = await client();
  const { data: existingEnrollment } = await c
    .from("enrollments")
    .select("register_number")
    .eq("id", user.rows.enrollments.id)
    .single();
  await page
    .getByLabel("Numero riga 1")
    .fill(String(existingEnrollment!.register_number));
  await page
    .getByRole("button", { name: "Verifica anteprima avanzata" })
    .click();
  await expect(page.getByRole("alert")).toContainText("registro");
  await page
    .getByLabel("Numero riga 1")
    .fill(String(10000 + Math.floor(Math.random() * 100000)));
  await page
    .getByRole("button", { name: "Verifica anteprima avanzata" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Anteprima validata" }),
  ).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Conferma importazione/ }).click();
  await expect(page.getByRole("heading", { name: /Report/ })).toBeVisible();
  await page.reload();
  await page.getByLabel("File da riconciliare").setInputFiles(file);
  await page
    .getByLabel("Classe predefinita")
    .selectOption(user.rows.classes.id);
  await page
    .getByRole("button", { name: "Verifica anteprima avanzata" })
    .click();
  await expect(page.getByText(/già applicat/)).toBeVisible();
  const { data } = await c
    .from("students")
    .select("id")
    .eq("external_code", code);
  expect(data).toHaveLength(1);
});

test("authorized workspace export excludes the other workspace and auth secrets", async ({
  page,
}) => {
  await login(page);
  await page.goto("./#/esportazione");
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Esporta dati autorizzati del workspace" })
    .click();
  const download = await pending;
  const path = await download.path();
  const data = JSON.parse(fs.readFileSync(path!, "utf8"));
  expect(data.workspace).toBe(user.workspace);
  expect(JSON.stringify(data)).not.toContain(users[1].workspace);
  expect(
    data.tables.students.some((s: any) => s.id === user.rows.students.id),
  ).toBe(true);
  expect(Object.keys(data.tables)).not.toContain("auth.users");
});

test("grid autosaves only explicit drafts, resumes scores and keeps publication deliberate", async ({
  page,
}) => {
  await login(page);
  await page.goto("./#/griglie");
  await page
    .getByRole("button", { name: "Crea griglia universale personalizzata" })
    .click();
  await page
    .getByLabel("Titolo verifica", { exact: true })
    .fill("Autosave fittizio " + Date.now());
  await page
    .getByLabel("Classe e materia della griglia")
    .selectOption(user.rows.teaching_assignments.id);
  for (let i = 0; i < 2; i++)
    await page.getByRole("button", { name: "Continua", exact: true }).click();
  await page
    .getByLabel("Regola di conversione", { exact: true })
    .selectOption(user.rows.evaluation_rules.id);
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await page
    .getByLabel(
      "Approvo struttura, massimali e conversione e creo lo snapshot della verifica.",
    )
    .check();
  await page.getByRole("button", { name: "Crea verifica con griglia" }).click();
  await expect(
    page.getByText("Non corretto: punteggio non assegnato", { exact: true }),
  ).toBeVisible();
  const route = page.url(),
    id = route.split("/").pop()!;
  const c = await client();
  const { data: before } = await c
    .from("question_results")
    .select("id")
    .eq("assessment_id", id);
  expect(before).toHaveLength(0);
  await page.getByLabel("Punti esercizio", { exact: true }).fill("0");
  await expect(page.getByText("Bozza salvata", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Punti esercizio", { exact: true })).toHaveValue(
    "0",
  );
  await page.getByRole("button", { name: "Assegna massimo esercizio" }).click();
  await expect(page.getByText("Bozza salvata", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Punti esercizio", { exact: true })).toHaveValue(
    "10",
  );
  const { data: grades } = await c
    .from("grade_entries")
    .select("status")
    .eq("origin", "assessment")
    .in(
      "assessment_result_id",
      (
        await c.from("assessment_results").select("id").eq("assessment_id", id)
      ).data!.map((r) => r.id),
    );
  expect(grades?.some((g) => g.status === "confirmed")).toBe(false);
});
