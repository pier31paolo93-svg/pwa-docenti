import { describe, it, expect } from "vitest";
import {
  distributePoints,
  units,
  gridErrors,
  mathematicalGrid,
  emptyGrid,
  duplicateGrid,
  provisionalGrade,
  eightyBands,
  gridSummary,
} from "./grids";
import {
  firstRegisterNumber,
  nextClassName,
  enrollmentCandidates,
  orderedEnrollments,
} from "./register";
describe("V1.2 exact grid arithmetic", () => {
  it("distributes the remainder without losing points", () => {
    expect(distributePoints("10", 3)).toEqual(["3.34", "3.33", "3.33"]);
    expect(distributePoints("1", 3, 3)).toEqual(["0.334", "0.333", "0.333"]);
    expect(distributePoints("10", 3, 0)).toEqual(["4", "3", "3"]);
  });
  it("rejects invalid precision and impossible allocations", () => {
    for (const v of ["-1", "NaN", "Infinity", "1.0001"])
      expect(() => units(v)).toThrow();
    expect(() => distributePoints(".01", 2)).toThrow();
    expect(() => distributePoints("1", 201)).toThrow();
  });
  it.each([
    ["algebra", true],
    ["algebra", false],
    ["biennio", true],
    ["biennio", false],
  ] as const)(
    "validates %s argumentation %s without inventing descriptors",
    (kind, arg) => {
      const g = mathematicalGrid(kind, arg);
      expect(gridErrors(g)).toEqual([]);
      expect(g.maximum).toBe(arg ? "100" : "80");
      expect(g.competencies.every((s) => s.description === "")).toBe(true);
    },
  );
  it("duplicates all model keys and detaches the rule", () => {
    const a = mathematicalGrid("algebra", true),
      b = duplicateGrid(a);
    expect(gridErrors(b)).toEqual([]);
    expect(b.sections[0].id).not.toBe(a.sections[0].id);
    expect(b.sections[0].exercises[0].criteria[0].competency_id).toBe(
      b.competencies[0].id,
    );
  });
  it("detects inconsistent totals and duplicate keys", () => {
    const g = emptyGrid();
    g.maximum = "11";
    expect(gridErrors(g).length).toBeGreaterThan(0);
    g.maximum = "10";
    g.sections[0].exercises[0].id = g.sections[0].id;
    expect(gridErrors(g).join()).toContain("duplicati");
  });
  it("uses continuous half-open bands and explicit normalization", () => {
    const rule = {
      id: "r",
      minimum: 0,
      maximum: 10,
      rounding_step: 0.1,
      conversion_mode: "bands",
      bands: eightyBands,
      band_maximum: 80,
    };
    for (const [score, grade] of [
      ["29.999", "3"],
      ["30", "4"],
      ["37.999", "4"],
      ["38", "5"],
      ["77.999", "9"],
      ["78", "10"],
      ["80", "10"],
    ])
      expect(provisionalGrade(score, "80", rule)).toBe(grade);
    expect(provisionalGrade("60", "160", rule)).toBe("4");
  });
  it("rounds and clamps linear proposals", () => {
    const r = {
      id: "r",
      minimum: 3,
      maximum: 10,
      rounding_step: 0.1,
      conversion_mode: "linear",
    };
    expect(provisionalGrade("0", "80", r)).toBe("3");
    expect(provisionalGrade("45", "80", r)).toBe("5.6");
  });
  it("does not invent analytical evidence from rapid scores", () => {
    const g = mathematicalGrid("biennio", false),
      e = g.sections[0].exercises[0],
      s = gridSummary(
        g,
        [
          {
            id: "q",
            assessment_result_id: "r",
            question_id: e.id,
            score: 15,
            criterion_scores: null,
          },
        ],
        "r",
      );
    expect(s.obtained).toBe("15");
    expect(s.skills[0].obtained).toBe("0");
    expect(s.skills[0].missing).toBe(1);
    expect(s.complete).toBe(false);
  });
});
describe("register and year transition", () => {
  it("finds the first free positive number", () =>
    expect(
      firstRegisterNumber(
        [
          { id: "a", class_id: "c", register_number: 1 },
          { id: "b", class_id: "c", register_number: 3 },
        ],
        "c",
      ),
    ).toBe(2));
  it("does not propose a sixth year", () => {
    expect(nextClassName("4 A")).toBe("5 A");
    expect(nextClassName("5 A")).toBe("");
    expect(nextClassName("5 A", true)).toBe("5 A");
  });
  it("orders missing numbers last and breaks ties deterministically", () => {
    const rows = [
      { id: "b", student_id: "s2", register_number: 2 },
      { id: "a", student_id: "s1", register_number: 1 },
      { id: "c", student_id: "s3" },
    ];
    expect(orderedEnrollments(rows, { students: [] }).map((r) => r.id)).toEqual(
      ["a", "b", "c"],
    );
  });
  it("excludes historical duplicates only in the selected class", () => {
    const students = [{ id: "s1" }, { id: "s2" }],
      classes = [
        { id: "c", school_year_id: "y" },
        { id: "other", school_year_id: "next" },
      ],
      enrollments = [
        { id: "e", class_id: "c", student_id: "s1", ends_on: "2025-06-30" },
      ];
    expect(
      enrollmentCandidates({ students, enrollments, classes }, "c").map(
        (r) => r.id,
      ),
    ).toEqual(["s2"]);
    expect(
      enrollmentCandidates({ students, enrollments, classes }, "other"),
    ).toHaveLength(2);
    expect(
      enrollmentCandidates(
        {
          students,
          classes,
          enrollments: enrollments.map((e) => ({
            ...e,
            deleted_at: "2026-01-01",
          })),
        },
        "c",
      ).map((s) => s.id),
    ).toEqual(["s2"]);
  });
});
