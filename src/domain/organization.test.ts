import { it, expect } from "vitest";
import {
  catalog,
  organizationEntries,
  organizationOrder,
  programmingOrder,
  evaluationOrder,
} from "./catalog";
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
for (const [group, order] of [
  ["Programmazione", programmingOrder],
  ["Valutazione", evaluationOrder],
] as const) {
  it(`${group} includes every resource once and places prerequisites before dependent resources`, () => {
    const entries = organizationEntries(group);
    expect(entries.map(([id]) => id)).toEqual(order);
    expect(new Set(order).size).toBe(order.length);
    for (const [id, entity] of entries) {
      for (const field of entity.fields) {
        const prerequisite = entries.findIndex(([key]) => key === field.ref);
        if (prerequisite >= 0 && field.ref !== id) {
          expect(prerequisite).toBeLessThan(
            entries.findIndex(([key]) => key === id),
          );
        }
      }
    }
  });
}
it("selects class and subject before the student when entering a grade", () => {
  expect(catalog.grade_entries!.fields.slice(0, 2).map((f) => f.name)).toEqual([
    "teaching_assignment_id",
    "enrollment_id",
  ]);
});
