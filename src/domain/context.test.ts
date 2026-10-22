import { it, expect } from "vitest";
import { currentAssignments } from "./context";
import type { DataMap } from "./catalog";
import { safeCell } from "../services/export";
it("limits quick observation assignments by school, year, class and subject", () => {
  const data: DataMap = {
    classes: [{ id: "class", school_id: "school", school_year_id: "year" }],
    class_subjects: [{ id: "cs", class_id: "class", subject_id: "math" }],
    teaching_assignments: [
      { id: "ta", class_id: "class", class_subject_id: "cs" },
    ],
  };
  const filters = {
    year: "year",
    school: "school",
    classId: "class",
    subject: "math",
  };
  expect(currentAssignments(data, filters)).toHaveLength(1);
  for (const field of ["year", "school", "classId", "subject"])
    expect(
      currentAssignments(data, { ...filters, [field]: "other" }),
    ).toHaveLength(0);
});
it("neutralizes formulas after leading whitespace and line breaks", () => {
  for (const value of ["   =SUM(1)", "\n=1", "\u00a0@SUM(A1:A2)"])
    expect(safeCell(value)).toBe("'" + value);
});
