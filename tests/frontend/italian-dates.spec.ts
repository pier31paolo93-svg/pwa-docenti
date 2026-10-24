import { test, expect } from "@playwright/test";
import fs from "node:fs";
const user = JSON.parse(
  fs.readFileSync(".local-test/e2e-users.json", "utf8"),
)[0];
test("Italian table, editor and export dates retain ISO values for persistence", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Entra nel quaderno" }).click();
  await expect(page.getByRole("heading", { name: /Buon/ })).toBeVisible();
  await page.goto("./#/archivio/enrollments");
  await page
    .getByRole("searchbox", { name: "Cerca nell’elenco" })
    .fill(user.rows.enrollments.id);
  await expect(
    page.getByRole("cell", { name: "01/09/2026", exact: true }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  const download = page.waitForEvent("download");
  await page.getByLabel("Esporta dati").selectOption("csv");
  const file = await (await download).path();
  expect(fs.readFileSync(file!, "utf8")).toContain("01/09/2026");
  await page
    .getByRole("row")
    .filter({ hasText: "01/09/2026" })
    .getByRole("button", { name: "Modifica", exact: true })
    .click();
  const input = page
    .getByRole("dialog")
    .getByLabel("Data di ingresso *", { exact: true });
  await expect(input).toHaveValue("2026-09-01");
  await input.fill("2026-10-25");
  await expect(
    page
      .getByRole("dialog")
      .getByText("gg/mm/aaaa · 25/10/2026", { exact: true }),
  ).toBeVisible();
  // Do not save this test change to the fixture's enrollment.
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Annulla", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("cell", { name: "01/09/2026", exact: true }),
  ).toBeVisible();
  await page.goto("./#/calendario");
  await page.getByLabel("Data calendario").fill("2026-10-25");
  await page.getByLabel("Vista calendario").selectOption("day");
  await expect(
    page.getByRole("heading", { name: "25/10/2026", exact: true }),
  ).toBeVisible();
});
