import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
test("annual enrollment candidates and student class on desktop and mobile", async ({
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
  const auth = await c.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (auth.error) throw auth.error;
  const source = await c
    .from("classes")
    .select("*")
    .eq("id", user.rows.classes.id)
    .single();
  if (source.error) throw source.error;
  const id = crypto.randomUUID();
  const created = await c.rpc("sync_mutation", {
    p_table: "classes",
    p_workspace: user.workspace,
    p_id: id,
    p_operation: crypto.randomUUID(),
    p_expected_version: 0,
    p_patch: {
      name: "Sezione fittizia " + id.slice(0, 8),
      school_id: source.data.school_id,
      school_year_id: source.data.school_year_id,
      visibility: "workspace",
    },
  });
  if (created.error) throw created.error;
  await page.goto("./");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Entra nel quaderno" }).click();
  await expect(page.getByRole("heading", { name: /Buon/ })).toBeVisible();
  await page.goto("./#/archivio/enrollments");
  await page.getByRole("button", { name: "Nuova iscrizione" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Classe *", { exact: true }).selectOption(id);
  await expect(
    dialog
      .getByLabel("Studente *", { exact: true })
      .locator(`option[value="${user.rows.students.id}"]`),
  ).toHaveCount(0);
  page.once("dialog", (confirmation) => confirmation.accept());
  await dialog.getByRole("button", { name: "Annulla", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto("./#/studenti");
  await expect(
    page.getByRole("heading", { name: "Studenti", exact: true }),
  ).toBeVisible();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 1280) {
      await expect(
        page.getByRole("columnheader", { name: "Classe", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("cell", { name: source.data.name, exact: true }).first(),
      ).toBeVisible();
    } else {
      await expect(
        page
          .locator(".resource-mobile dd")
          .filter({ hasText: source.data.name })
          .first(),
      ).toBeVisible();
    }
  }
});
