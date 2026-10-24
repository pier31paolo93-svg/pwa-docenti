import { it, expect } from "vitest";
import { withdrawalVisibility, preservedWithdrawals } from "./withdrawn";
const data = {
  classes: [
    { id: "a", school_year_id: "y" },
    { id: "b", school_year_id: "next" },
  ],
  students: [{ id: "withdrawn" }, { id: "active" }, { id: "unassigned" }],
  enrollments: [
    { id: "e1", student_id: "withdrawn", class_id: "a", outcome: "withdrawn" },
    { id: "e2", student_id: "active", class_id: "a", outcome: null },
  ],
  assessment_results: [
    { id: "result", enrollment_id: "e1" },
    { id: "ok", enrollment_id: "e2" },
  ],
  question_results: [{ id: "question", assessment_result_id: "result" }],
  homework_checks: [{ id: "check", enrollment_id: "e1" }],
  homework_exercise_results: [{ id: "exercise", homework_check_id: "check" }],
  observations: [{ id: "observation", enrollment_id: "e1" }],
  grade_entries: [{ id: "grade", enrollment_id: "e1" }],
};
it("hides withdrawn rosters and linked evidence without changing canonical records", () => {
  const before = JSON.stringify(data);
  const result = withdrawalVisibility(data);
  expect(result.data.students?.map((r) => r.id)).toEqual([
    "active",
    "unassigned",
  ]);
  expect(result.data.enrollments?.map((r) => r.id)).toEqual(["e2"]);
  expect(result.data.assessment_results?.map((r) => r.id)).toEqual(["ok"]);
  for (const table of [
    "question_results",
    "homework_checks",
    "homework_exercise_results",
    "observations",
    "grade_entries",
  ] as const)
    expect(result.data[table]).toEqual([]);
  expect(JSON.stringify(data)).toBe(before);
});
it("filters fetched views, recovery targets and error links as well", () => {
  const { visible } = withdrawalVisibility(data);
  expect(visible("v_grade_register", { id: "g", enrollment_id: "e1" })).toBe(
    false,
  );
  expect(
    visible("v_student_averages", {
      id: "a",
      student_id: "withdrawn",
      school_year_id: "y",
    }),
  ).toBe(false);
  expect(visible("recovery_students", { id: "r", enrollment_id: "e1" })).toBe(
    false,
  );
  expect(
    visible("question_errors", { id: "r", question_result_id: "question" }),
  ).toBe(false);
  expect(
    visible("homework_errors", { id: "r", exercise_result_id: "exercise" }),
  ).toBe(false);
  expect(
    visible("observation_errors", { id: "r", observation_id: "observation" }),
  ).toBe(false);
  expect(visible("v_grade_register", { id: "g", enrollment_id: "e2" })).toBe(
    true,
  );
});
it("keeps a new active enrollment in another year while hiding the withdrawn one", () => {
  const result = withdrawalVisibility(
    {
      ...data,
      enrollments: [
        ...data.enrollments,
        { id: "next", student_id: "withdrawn", class_id: "b", outcome: null },
      ],
    },
    "next",
  );
  expect(result.data.students?.some((s) => s.id === "withdrawn")).toBe(true);
  expect(result.data.enrollments?.map((e) => e.id)).toEqual(["e2", "next"]);
  expect(
    result.visible("v_student_averages", {
      id: "a",
      student_id: "withdrawn",
      school_year_id: "y",
    }),
  ).toBe(false);
});
it("restores operational visibility when the withdrawn outcome is removed", () => {
  const result = withdrawalVisibility({
    ...data,
    enrollments: data.enrollments.map((e) => ({ ...e, outcome: null })),
  });
  expect(result.data.students).toEqual(data.students);
  expect(result.data.assessment_results).toEqual(data.assessment_results);
});
it("does not make a withdrawn-only student reappear when selecting a different year", () => {
  expect(
    withdrawalVisibility(data, "next").data.students?.some(
      (s) => s.id === "withdrawn",
    ),
  ).toBe(false);
});
it("preserves hidden withdrawals as no-op entries in the complete year transition plan", () => {
  expect(preservedWithdrawals(data, ["a"])).toEqual([
    {
      enrollment_id: "e1",
      version: undefined,
      outcome: "pending",
      destination_id: null,
      register_number: null,
    },
  ]);
  expect(preservedWithdrawals(data, ["b"])).toEqual([]);
  expect(
    preservedWithdrawals(
      {
        ...data,
        enrollments: data.enrollments.map((e) => ({
          ...e,
          ends_on: "2026-06-30",
        })),
      },
      ["a"],
    ),
  ).toEqual([]);
});
