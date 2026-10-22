import { it, expect } from "vitest";
import { organizationEntries, organizationOrder } from "./catalog";
it("keeps the exact organization order and labels regardless of viewport", () => {
  const entries = organizationEntries("Organizzazione");
  expect(entries.map(([id]) => id)).toEqual(organizationOrder);
  expect(entries.map(([, c]) => c.title)).toEqual([
    "Anni scolastici",
    "Scuole",
    "Materie",
    "Classi",
    "Classi / Materie",
    "Assegnazioni docenti",
    "Studenti",
    "Iscrizioni",
  ]);
});
