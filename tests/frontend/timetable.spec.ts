import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const user = JSON.parse(
  fs.readFileSync(".local-test/e2e-users.json", "utf8"),
)[0];
async function setup() {
  const env = fs.readFileSync(".env.test.local", "utf8");
  if (!env.includes("VITE_SUPABASE_URL=http://127.0.0.1:56321"))
    throw Error("Local fictitious fixtures only");
  const c = createClient(
    "http://127.0.0.1:56321",
    env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)![1].trim(),
    { auth: { persistSession: false } },
  );
  const login = await c.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (login.error) throw login.error;
  async function add(table: string, patch: Record<string, unknown>) {
    const r = await c
      .from(table)
      .insert({ ...patch, workspace_id: user.workspace })
      .select()
      .single();
    if (r.error) throw r.error;
    return r.data;
  }
  const versions = await c.from("timetable_versions").select("id");
  if (versions.error) throw versions.error;
  const year = 2050 + (versions.data?.length ?? 0) * 2;
  const y = await add("school_years", {
    label: "Orario fittizio " + Date.now(),
    starts_on: `${year}-09-01`,
    ends_on: `${year + 1}-08-31`,
  });
  const cls = await add("classes", {
    name: "1 B orario fittizio",
    school_id: user.rows.schools.id,
    school_year_id: y.id,
  });
  const cs = await add("class_subjects", {
    class_id: cls.id,
    subject_id: user.rows.subjects.id,
  });
  const ta = await add("teaching_assignments", {
    class_id: cls.id,
    class_subject_id: cs.id,
    teacher_id: user.id,
  });
  let monday = `${year}-09-01`;
  while (new Date(monday + "T12:00:00Z").getUTCDay() !== 1) {
    const d = new Date(monday + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    monday = d.toISOString().slice(0, 10);
  }
  return { c, y, cls, ta, year, monday, add };
}
async function login(page: Page) {
  await page.goto("./");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Entra nel quaderno" }).click();
  await expect(page.getByRole("heading", { name: /Buon/ })).toBeVisible();
  page.on("dialog", (d) => d.accept());
}
test("timetable creates real slots, activates safely, opens canonical lesson once, supports exceptions, copy and offline", async ({
  page,
  browserName,
}) => {
  test.setTimeout(150000);
  const f = await setup();
  await login(page);
  await page.goto("./#/orario");
  await page.getByLabel("Anno orario").selectOption(f.y.id);
  await page
    .getByText("Crea o modifica versione in bozza", { exact: true })
    .click();
  await page
    .getByLabel("Nome versione", { exact: true })
    .fill("Provvisorio fittizio E2E");
  await page
    .getByLabel("Inizio validità", { exact: true })
    .fill(`${f.year}-09-01`);
  await page
    .getByLabel("Fine validità (opzionale)")
    .fill(`${f.year + 1}-08-31`);
  await page
    .getByRole("button", { name: "Crea versione", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Provvisorio fittizio E2E",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Classe slot", { exact: true }).selectOption(f.cls.id);
  await page
    .getByLabel("Materia assegnata", { exact: true })
    .selectOption(f.ta.id);
  await page.getByLabel("Giorno slot", { exact: true }).selectOption("1");
  await page.getByLabel("Inizio slot", { exact: true }).fill("08:15");
  await page.getByLabel("Fine slot", { exact: true }).fill("09:45");
  await page.getByRole("button", { name: "Salva slot", exact: true }).click();
  await expect(
    page.getByText("90 min · 1.5 ore", { exact: false }).first(),
  ).toBeVisible();
  const version = (
    await f.c
      .from("timetable_versions")
      .select("*")
      .eq("school_year_id", f.y.id)
      .single()
  ).data!;
  const slot = (
    await f.c
      .from("timetable_slots")
      .select("*")
      .eq("timetable_version_id", version.id)
      .single()
  ).data!;
  expect(slot.teaching_assignment_id).toBe(f.ta.id);
  await page.getByLabel("Giorno orario").selectOption("1");
  fs.mkdirSync(".local-test/v15-screenshots", { recursive: true });
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["tablet", 834, 1194],
    ["phone", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.getByRole("heading", { level: 1 }).click();
    await page.screenshot({
      path: `.local-test/v15-screenshots/${browserName}-${name}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  }
  await page
    .getByLabel(
      "Confermo periodo, slot e chiusura dell’eventuale versione precedente.",
    )
    .check();
  await page
    .getByRole("button", { name: "Attiva orario", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Variazioni giornaliere" }),
  ).toBeVisible();
  await page.getByLabel("Data variazione", { exact: true }).fill(f.monday);
  await page.locator('select[name="slot"]').selectOption(slot.id);
  await page
    .getByRole("button", { name: "Salva variazione", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (
          await f.c
            .from("timetable_exceptions")
            .select("id")
            .eq("slot_id", slot.id)
            .eq("occurs_on", f.monday)
        ).data?.length,
    )
    .toBe(1);
  const cancelled = await f.c.rpc("register_timetable_lesson", {
    p_occurrence: slot.id,
    p_day: f.monday,
  });
  expect(cancelled.error?.code).toBe("23514");
  const next = new Date(f.monday + "T12:00:00Z");
  next.setUTCDate(next.getUTCDate() + 7);
  const day = next.toISOString().slice(0, 10);
  await page.goto(
    `./#/registro-rapido?occurrence=${slot.id}&day=${day}&assignment=${f.ta.id}`,
  );
  await expect(
    page.getByText("Slot selezionato: 08:15–09:45.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Apri o registra la lezione selezionata",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Salvato." }).first(),
  ).toBeVisible();
  const first = await f.c
    .from("lessons")
    .select("id")
    .eq("timetable_occurrence_id", slot.id)
    .eq("timetable_occurs_on", day);
  expect(first.data).toHaveLength(1);
  await page
    .getByRole("button", {
      name: "Apri o registra la lezione selezionata",
      exact: true,
    })
    .click();
  expect(
    (
      await f.c
        .from("lessons")
        .select("id")
        .eq("timetable_occurrence_id", slot.id)
        .eq("timetable_occurs_on", day)
    ).data,
  ).toHaveLength(1);
  await page.goto("./#/calendario");
  await page.getByLabel("Data calendario", { exact: true }).fill(day);
  await expect(
    page.getByRole("link", { name: /Lezione da orario/ }),
  ).toHaveCount(1);
  await page.goto("./#/orario");
  await page.getByLabel("Anno orario").selectOption(f.y.id);
  await page
    .getByText("Duplica settimana / copia struttura da altro anno", {
      exact: true,
    })
    .click();
  await page
    .getByRole("combobox", { name: "Orario da copiare", exact: true })
    .selectOption(version.id);
  await page
    .getByLabel("Nome nuova bozza", { exact: true })
    .fill("Definitivo fittizio E2E");
  await page
    .getByRole("button", { name: "Crea copia in bozza", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Definitivo fittizio E2E", exact: true }),
  ).toBeVisible();
  const clones = await f.c
    .from("timetable_versions")
    .select("*")
    .eq("school_year_id", f.y.id)
    .eq("name", "Definitivo fittizio E2E");
  expect(clones.data?.[0].status).toBe("draft");
  await page.context().setOffline(true);
  await expect(
    page.getByText("Copia offline potenzialmente non aggiornata.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Attiva orario", exact: true }),
  ).toBeDisabled();
  await page.context().setOffline(false);
});
test("missing timetable migration preserves old app and explains activation", async ({
  page,
}) => {
  await page.route("**/rest/v1/timetable_*", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ code: "PGRST205", message: "Missing relation" }),
    }),
  );
  await login(page);
  await page.goto("./#/orario");
  await expect(
    page.getByText("Orario disponibile dopo la migrazione V1.5 (27)", {
      exact: false,
    }),
  ).toBeVisible();
  await page.goto("./#/registro");
  await expect(
    page.getByRole("heading", { name: "Registro lezioni", exact: true }),
  ).toBeVisible();
});
