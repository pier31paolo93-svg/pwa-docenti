import { describe, it, expect } from "vitest";
import {
  occurrences,
  weekday,
  duration,
  timetableRange,
  occurrenceRoute,
  type TimetableData,
} from "./timetable";
import type { DataMap } from "./catalog";
const t: TimetableData = {
  versions: [
    {
      id: "v",
      school_year_id: "y",
      teacher_id: "t",
      status: "active",
      valid_from: "2026-09-01",
      valid_to: "2027-08-31",
    },
  ],
  slots: [
    {
      id: "s",
      timetable_version_id: "v",
      teaching_assignment_id: "a",
      weekday: 2,
      starts_at: "08:15:00",
      ends_at: "09:45:00",
    },
  ],
  exceptions: [],
};
const data: DataMap = {
  classes: [{ id: "c", school_id: "school" }],
  teaching_assignments: [{ id: "a", class_id: "c" }],
  school_years: [{ id: "y", ends_on: "2027-08-31" }],
};
describe("weekly timetable", () => {
  it("uses Rome day near midnight and DST", () => {
    expect(weekday("2026-10-26T23:30:00Z")).toBe(2);
    expect(weekday("2026-03-29")).toBe(7);
  });
  it("calculates real duration without fixed school periods", () =>
    expect(duration("08:15", "09:45")).toBe("90 min · 1.5 ore"));
  it("selects teacher, year, school and effective date", () => {
    expect(occurrences(t, data, "2026-10-27", "t", "y", "school")).toHaveLength(
      1,
    );
    for (const args of [
      ["other", "y", "school"],
      ["t", "other", "school"],
      ["t", "y", "other"],
    ])
      expect(
        occurrences(
          t,
          data,
          "2026-10-27",
          ...(args as [string, string, string]),
        ),
      ).toHaveLength(0);
    expect(occurrences(t, data, "2027-09-07", "t")).toHaveLength(0);
  });
  it("does not render drafts", () =>
    expect(
      occurrences(
        { ...t, versions: [{ ...t.versions[0], status: "draft" }] },
        data,
        "2026-10-27",
        "t",
      ),
    ).toHaveLength(0));
  it("applies cancellations without removing the recurring template", () => {
    const cancelled = {
      ...t,
      exceptions: [
        {
          id: "e",
          timetable_version_id: "v",
          slot_id: "s",
          occurs_on: "2026-10-27",
          kind: "cancelled",
        },
      ],
    };
    expect(occurrences(cancelled, data, "2026-10-27", "t")[0].cancelled).toBe(
      true,
    );
    expect(occurrences(cancelled, data, "2026-11-03", "t")[0].cancelled).toBe(
      false,
    );
  });
  it("adds extra lessons and sorts by effective time", () => {
    const changed = {
      ...t,
      exceptions: [
        {
          id: "e",
          timetable_version_id: "v",
          occurs_on: "2026-10-27",
          kind: "additional",
          teaching_assignment_id: "a",
          starts_at: "07:30:00",
          ends_at: "08:00:00",
        },
      ],
    };
    expect(
      occurrences(changed, data, "2026-10-27", "t").map((o) => o.id),
    ).toEqual(["e", "s"]);
  });
  it("links actual lessons and avoids creating duplicates", () => {
    const actual = {
      ...data,
      lessons: [
        {
          id: "l",
          teaching_assignment_id: "a",
          starts_at: "2026-10-27T07:15:00Z",
          ends_at: "2026-10-27T08:45:00Z",
        },
      ],
    };
    const o = occurrences(t, actual, "2026-10-27", "t")[0];
    expect(o.lesson?.id).toBe("l");
    expect(occurrenceRoute(o)).toBe("/registro/l");
  });
  it("recurs lazily across range without lesson writes", () => {
    expect(
      timetableRange(t, data, "2026-10-26", "2026-11-08", "t"),
    ).toHaveLength(2);
    expect(data.lessons).toBeUndefined();
  });
  it("distinguishes consecutive provisional and definitive versions", () => {
    const changed = {
      ...t,
      versions: [
        { ...t.versions[0], valid_to: "2026-10-31" },
        { ...t.versions[0], id: "v2", valid_from: "2026-11-01" },
      ],
      slots: [
        ...t.slots,
        {
          ...t.slots[0],
          id: "s2",
          timetable_version_id: "v2",
          starts_at: "10:00:00",
          ends_at: "11:00:00",
        },
      ],
    };
    expect(
      occurrences(changed, data, "2026-11-03", "t").map((o) => o.id),
    ).toEqual(["s2"]);
  });
});
