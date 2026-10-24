import { describe, it, expect } from "vitest";
import { enrollmentCandidates, studentClassLabel } from "./register";
const classes = [
  { id: "a", name: "1A", workspace_id: "w", school_year_id: "y" },
  { id: "b", name: "1B", workspace_id: "w", school_year_id: "y" },
  { id: "next", name: "2A", workspace_id: "w", school_year_id: "next" },
];
const students = [
  { id: "enrolled" },
  { id: "free" },
  { id: "archived", archived_at: "2026-01-01" },
];
const data = {
  classes,
  students,
  school_years: [
    { id: "y", ends_on: "2026-06-30" },
    { id: "next", ends_on: "2027-06-30" },
  ],
  enrollments: [
    { id: "e", student_id: "enrolled", class_id: "a", ends_on: "2026-06-30" },
  ],
};
describe("one class per school year", () => {
  it("excludes an existing association in another class of the same year, including closed enrollments", () => {
    expect(enrollmentCandidates(data, "b").map((s) => s.id)).toEqual(["free"]);
  });
  it("allows the next school year", () => {
    expect(enrollmentCandidates(data, "next").map((s) => s.id)).toEqual([
      "enrolled",
      "free",
    ]);
  });
  it("allows deleted associations in another class but retains same-class restore protection", () => {
    const deleted = {
      ...data,
      enrollments: data.enrollments.map((e) => ({
        ...e,
        deleted_at: "2026-01-01",
      })),
    };
    expect(enrollmentCandidates(deleted, "b")).toHaveLength(2);
    expect(enrollmentCandidates(deleted, "a").map((s) => s.id)).toEqual([
      "free",
    ]);
  });
  it("does not offer students before the class metadata is available", () => {
    expect(enrollmentCandidates({ students }, "unknown")).toEqual([]);
  });
  it("shows the class for the selected year and leaves unassigned students blank", () => {
    expect(studentClassLabel("enrolled", data, "y")).toBe("1A");
    expect(studentClassLabel("enrolled", data, "next")).toBe("");
    expect(studentClassLabel("free", data, "y")).toBe("");
    expect(studentClassLabel("enrolled", data, "y", "b")).toBe("1A");
  });
  it("uses the latest associated year when no year filter is selected", () => {
    expect(
      studentClassLabel("enrolled", {
        ...data,
        enrollments: [
          ...data.enrollments,
          { id: "n", student_id: "enrolled", class_id: "next", ends_on: "" },
        ],
      }),
    ).toBe("2A");
  });
});
