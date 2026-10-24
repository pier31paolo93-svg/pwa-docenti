import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
test("withdrawn student remains administrative but disappears from operational rosters", async ({
  page,
}) => {
  const user = JSON.parse(
    fs.readFileSync(".local-test/e2e-users.json", "utf8"),
  )[0];
  const env = fs.readFileSync(".env.test.local", "utf8");
  if (!env.includes("VITE_SUPABASE_URL=http://127.0.0.1:56321"))
    throw Error("Local fixtures only");
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
    const id = crypto.randomUUID();
    const result = await c.rpc("sync_mutation", {
      p_table: table,
      p_workspace: user.workspace,
      p_id: id,
      p_operation: crypto.randomUUID(),
      p_expected_version: 0,
      p_patch: { ...patch, visibility: "workspace" },
    });
    if (result.error) throw result.error;
    return id;
  }
  const code = "RIT-FITTIZIO-" + crypto.randomUUID();
  const student = await add("students", {
    external_code: code,
    first_name: "Esempio",
    last_name: code,
  });
  const original = await c
    .from("enrollments")
    .select("starts_on")
    .eq("id", user.rows.enrollments.id)
    .single();
  if (original.error) throw original.error;
  const enrollment = await add("enrollments", {
    student_id: student,
    class_id: user.rows.classes.id,
    starts_on: original.data.starts_on,
  });
  await page.goto("./");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Entra nel quaderno" }).click();
  await expect(page.getByRole("heading", { name: /Buon/ })).toBeVisible();
  await page.goto("./#/registro/" + user.rows.lessons.id);
  await expect(page.getByRole("link").filter({ hasText: code })).toBeVisible();
  await page.goto("./#/archivio/enrollments");
  await page
    .getByRole("searchbox", { name: "Cerca nell’elenco" })
    .fill(enrollment);
  // The search matches the stored ID; the displayed student label remains human-readable.
  await page
    .getByRole("row")
    .filter({ hasText: code })
    .getByRole("button", { name: "Modifica", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Esito", { exact: true })
    .selectOption("withdrawn");
  await page
    .getByRole("button", { name: "Salva modifiche", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("row").filter({ hasText: code })).toBeVisible();
  await page.goto("./#/studenti");
  await page.getByRole("searchbox", { name: "Cerca nell’elenco" }).fill(code);
  await expect(page.getByRole("row").filter({ hasText: code })).toBeVisible();
  for (const [route, id] of [
    ["registro", user.rows.lessons.id],
    ["verifiche", user.rows.assessments.id],
    ["compiti", user.rows.assignments.id],
  ]) {
    await page.goto(`./#/${route}/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link").filter({ hasText: code })).toHaveCount(
      0,
    );
    await expect(page.locator("option").filter({ hasText: code })).toHaveCount(
      0,
    );
  }
  const retained = await c
    .from("enrollments")
    .select("outcome,deleted_at,student_id,starts_on")
    .eq("id", enrollment)
    .single();
  expect(retained.error).toBeNull();
  expect(retained.data).toEqual({
    outcome: "withdrawn",
    deleted_at: null,
    student_id: student,
    starts_on: original.data.starts_on,
  });
});
