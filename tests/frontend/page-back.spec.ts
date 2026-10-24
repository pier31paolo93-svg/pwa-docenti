import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
const user = JSON.parse(
  fs.readFileSync(".local-test/e2e-users.json", "utf8"),
)[0];
async function login(page: Page, path = "") {
  await page.goto("./" + path);
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Entra nel quaderno" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}
test("back returns to the previous app page on desktop, tablet and phone", async ({
  page,
}) => {
  await login(page);
  for (const width of [1440, 820, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("./#/organizzazione");
    await page.getByRole("link", { name: "Argomenti", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Argomenti", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Torna alla pagina precedente" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Organizza il quaderno", exact: true }),
    ).toBeVisible();
  }
});
test("a directly opened page falls back to its parent section", async ({
  page,
}) => {
  await login(page, "#/archivio/topics");
  await expect(
    page.getByRole("heading", { name: "Argomenti", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Torna alla pagina precedente" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Organizza il quaderno", exact: true }),
  ).toBeVisible();
});
test("back protects unsaved year-transition changes", async ({ page }) => {
  await login(page);
  await page.goto("./#/organizzazione");
  await page.getByRole("link", { name: "Passaggio anno", exact: true }).click();
  await page
    .getByLabel("Anno di origine", { exact: true })
    .selectOption({ label: "2026/2027 test" });
  const back = page.getByRole("button", {
    name: "Torna alla pagina precedente",
  });
  page.once("dialog", (d) => d.dismiss());
  await back.click();
  await expect(
    page.getByRole("heading", { name: "Passaggio anno", exact: true }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await back.click();
  await expect(
    page.getByRole("heading", { name: "Organizza il quaderno", exact: true }),
  ).toBeVisible();
});
