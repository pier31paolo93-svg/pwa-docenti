import { describe, it, expect } from "vitest";
import { catalog, derivePatch } from "./catalog";
import { formSchema, serialize } from "./validation";
import { safeCell } from "../services/export";
describe("Data validation", () => {
  it("rejects missing required student data", () =>
    expect(
      formSchema(catalog.students!.fields).safeParse({
        first_name: "",
        last_name: "Fittizio",
        external_code: "A",
      }).success,
    ).toBe(false));
  it("rejects lessons ending before start", () =>
    expect(
      formSchema(catalog.lessons!.fields).safeParse({
        title: "Test",
        teaching_assignment_id: "a",
        starts_at: "2026-10-22T10:00",
        ends_at: "2026-10-22T09:00",
        status: "draft",
      }).success,
    ).toBe(false));
  it("rejects invalid numeric scores and malformed JSON", () => {
    expect(
      formSchema(catalog.rubric_criteria!.fields).safeParse({
        rubric_id: "a",
        label: "Criterio",
        weight: -1,
        max_score: 10,
        levels: "{",
      }).success,
    ).toBe(false);
  });
  it("requires a number before grade confirmation", () =>
    expect(
      formSchema(catalog.grade_entries!.fields).safeParse({
        status: "confirmed",
        confirmed_value: "",
      }).success,
    ).toBe(false));
  it("serializes numbers, optional dates and JSON without coercing empty values to zero", () =>
    expect(
      serialize(
        [
          { name: "score", label: "Score", type: "number" },
          { name: "date", label: "Data", type: "date" },
          { name: "levels", label: "Livelli", type: "json" },
        ],
        { score: "2.5", date: "", levels: "[1,2]" },
      ),
    ).toEqual({ score: 2.5, date: null, levels: [1, 2] }));
  it("derives composite context from the selected teaching assignment", () =>
    expect(
      derivePatch(
        "observations",
        { teaching_assignment_id: "ta" },
        { teaching_assignments: [{ id: "ta", class_id: "c" }] },
      ).class_id,
    ).toBe("c"));
  it.each(['=HYPERLINK("x")', "+CMD", "-1+1", "@SUM(A1:A2)", "\t=1"])(
    "neutralizes spreadsheet formula %s",
    (value) => expect(safeCell(value)).toBe("'" + value),
  );
  it("preserves Italian names and plain text", () =>
    expect(safeCell("Città, unità")).toBe("Città, unità"));
});
