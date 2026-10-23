import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
const users = JSON.parse(fs.readFileSync(".local-test/e2e-users.json", "utf8"));
async function login(page: Page) {
  await page.goto("./");
  await page.getByLabel("Email", { exact: true }).fill(users[0].email);
  await page.getByLabel("Password", { exact: true }).fill(users[0].password);
  await page.getByRole("button", { name: "Entra nel quaderno" }).click();
  await expect(page.getByRole("heading", { name: /Buon/ })).toBeVisible();
}
test("universal grid creates canonical assessment, saves rapid and analytical scores, exports A4", async ({
  page,
}) => {
  await page.setViewportSize({ width: 834, height: 1194 });
  page.on("dialog", (d) => d.accept());
  await login(page);
  await page.goto("./#/griglie");
  await page
    .getByRole("button", { name: "Crea griglia universale personalizzata" })
    .click();
  await page
    .getByLabel("Titolo verifica", { exact: true })
    .fill("V12 browser fittizio " + Date.now());
  await page
    .getByLabel("Classe e materia della griglia")
    .selectOption({ index: 1 });
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await page
    .getByLabel("Regola di conversione", { exact: true })
    .selectOption({ index: 1 });
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await page
    .getByLabel(
      "Approvo struttura, massimali e conversione e creo lo snapshot della verifica.",
    )
    .check();
  await page.getByRole("button", { name: "Crea verifica con griglia" }).click();
  await expect(page).toHaveURL(/verifiche\/[a-f0-9-]+/);
  await expect(page.getByLabel("Studente", { exact: true })).toBeVisible();
  await page.getByLabel("Punti esercizio", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Salva senza uscire" }).click();
  await expect(page.getByText(/Punti 8\/10/)).toBeVisible();
  await page.getByLabel("Modalità punteggio").selectOption("analytic");
  await page.getByLabel("Procedimento / 10").fill("7");
  await page.getByRole("button", { name: "Salva senza uscire" }).click();
  await expect(page.getByText(/Punti 7\/10/)).toBeVisible();
  await page
    .getByLabel("Categoria", { exact: true })
    .selectOption({ index: 1 });
  await page.getByRole("button", { name: "Calcola e salva bozza" }).click();
  await expect(
    page.getByText("Bozza salvata. Verifica la proposta prima della conferma."),
  ).toBeVisible();
  const dir = ".local-test/v12-pdf";
  fs.mkdirSync(dir, { recursive: true });
  for (const name of [
    "PDF vuoto",
    "PDF studente",
    "PDF classe",
    "PDF competenze",
  ]) {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name, exact: true }).click();
    const d = await download;
    await d.saveAs(dir + "/" + d.suggestedFilename());
  }
  await page.reload();
  await expect(page.getByText(/Punti 7\/10/)).toBeVisible();
  await expect(page.getByText("Stato: Bozza", { exact: false })).toBeVisible();
  const route = page.url();
  await page.goto("./#/impostazioni");
  await page.getByRole("button", { name: "Abilita e prepara dati" }).click();
  await expect(
    page.getByRole("button", { name: "Rimuovi copia locale" }),
  ).toBeEnabled();
  await page.goto(route);
  await expect(page.getByText(/Punti 7\/10/)).toBeVisible();
  await page.context().setOffline(true);
  await page.getByLabel("Procedimento / 10").fill("8");
  await page.getByRole("button", { name: "Salva senza uscire" }).click();
  await expect(page.getByText(/Punti 8\/10/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Conferma voto", exact: true }),
  ).toBeDisabled();
  await page.goto("./#/sincronizzazione");
  await expect(page.getByText("In attesa", { exact: true })).toBeVisible();
  await page.context().setOffline(false);
  await expect(page.getByText("Nessuna modifica in attesa")).toBeVisible();
  await page.goto(route);
  await expect(page.getByText(/Punti 8\/10/)).toBeVisible();
});
test("year transition preview remains read-only and is blocked offline", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  page.on("dialog", (d) => d.accept());
  await login(page);
  await page.goto("./#/passaggio-anno");
  await page
    .getByLabel("Anno di origine", { exact: true })
    .selectOption({ label: "2026/2027 test" });
  await page
    .locator("main")
    .getByLabel("Scuola", { exact: true })
    .selectOption({ label: "Scuola fittizia E2E" });
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Esiti degli studenti" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await page.getByRole("button", { name: "Verifica anteprima" }).click();
  await expect(
    page.getByRole("heading", { name: "Anteprima verificata dal server" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Applica passaggio anno" }),
  ).toBeDisabled();
  await page.context().setOffline(true);
  await expect(
    page.getByText("Offline: anteprima e applicazione sono bloccate.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByLabel(
      "Approvo gli esiti, le destinazioni, i numeri e gli incarichi mostrati. Confermo il passaggio anno.",
    )
    .check();
  await expect(
    page.getByRole("button", { name: "Applica passaggio anno" }),
  ).toBeDisabled();
  await page.context().setOffline(false);
});
test("enrollment selects class first and excludes already enrolled students", async ({
  page,
}) => {
  await login(page);
  await page.goto("./#/archivio/enrollments");
  await page.getByRole("button", { name: "Nuova iscrizione" }).click();
  const dialog = page.getByRole("dialog");
  const pupil = dialog.getByLabel("Studente *", { exact: true });
  await expect(pupil).toBeDisabled();
  await dialog
    .getByLabel("Classe *", { exact: true })
    .selectOption(users[0].rows.classes.id);
  await expect(pupil).toBeEnabled();
  await expect(
    pupil.locator(`option[value="${users[0].rows.students.id}"]`),
  ).toHaveCount(0);
  expect(
    Number(
      await dialog
        .getByLabel("Numero di registro", { exact: true })
        .inputValue(),
    ),
  ).toBeGreaterThan(0);
  await dialog
    .getByLabel("Cerca studente da iscrivere")
    .fill("nessun-candidato-fittizio-uuid");
  await expect(pupil.locator("option")).toHaveCount(1);
});
