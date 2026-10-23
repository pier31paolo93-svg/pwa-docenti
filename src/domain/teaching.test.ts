import { describe, it, expect } from "vitest";
import {
  romeDay,
  dayShift,
  calendarRange,
  teachingEvents,
  confirmedStatistics,
  assessmentProgress,
  changedFields,
} from "./teaching";
describe("calendar dates in Europe/Rome", () => {
  it("keeps date-only values without timezone shifts", () =>
    expect(romeDay("2026-10-25")).toBe("2026-10-25"));
  it("uses Rome midnight across winter and summer offsets", () => {
    expect(romeDay("2026-01-01T23:30:00Z")).toBe("2026-01-02");
    expect(romeDay("2026-07-01T22:30:00Z")).toBe("2026-07-02");
  });
  it("handles daylight saving transitions without losing calendar days", () => {
    expect(dayShift("2026-03-28", 1)).toBe("2026-03-29");
    expect(dayShift("2026-10-25", 1)).toBe("2026-10-26");
    expect(romeDay("2026-10-25T00:30:00Z")).toBe("2026-10-25");
    expect(romeDay("2026-10-25T01:30:00Z")).toBe("2026-10-25");
  });
  it("uses Monday-Sunday weeks and full calendar months", () => {
    expect(calendarRange("2026-10-25", "week")).toEqual([
      "2026-10-19",
      "2026-10-25",
    ]);
    expect(calendarRange("2028-02-05", "month")).toEqual([
      "2028-02-01",
      "2028-02-29",
    ]);
  });
  it("projects events from canonical records and reflects edits", () => {
    const filters = { year: "", classId: "", school: "", subject: "" },
      data = {
        assessments: [
          {
            id: "a",
            title: "Originale",
            kind: "oral",
            assessed_on: "2026-10-25",
          },
        ],
      };
    const events = teachingEvents(data, filters);
    expect(events[0].route).toBe("/verifiche/a");
    expect(events[0].kind).toBe("oral");
    data.assessments[0].title = "Modificata";
    expect(teachingEvents(data, filters)[0].title).toBe("Modificata");
  });
});
describe("honest teaching analysis", () => {
  it("excludes drafts, cancelled and null grades", () => {
    const stats = confirmedStatistics([
      { id: "a", status: "draft", confirmed_value: 10 },
      { id: "b", status: "confirmed", confirmed_value: null },
      { id: "c", status: "cancelled", confirmed_value: 9 },
      { id: "d", status: "confirmed", confirmed_value: 6 },
    ]);
    expect(stats.count).toBe(1);
    expect(stats.mean).toBe(6);
    expect(stats.small).toBe(true);
  });
  it("calculates even medians and pass percentages", () => {
    const stats = confirmedStatistics(
      [4, 6, 8, 10].map((n, i) => ({
        id: String(i),
        status: "confirmed",
        confirmed_value: n,
      })),
      6,
    );
    expect(stats.median).toBe(7);
    expect(stats.mean).toBe(7);
    expect(stats.passPercent).toBe(75);
  });
  it("does not invent a zero when no grades exist", () => {
    const stats = confirmedStatistics([]);
    expect(stats.minimum).toBeNull();
    expect(stats.mean).toBeNull();
    expect(stats.passPercent).toBeNull();
  });
  it("distinguishes absence from uncorrected and incomplete", () => {
    const a = { id: "a", correction_mode: "analytic" },
      e = { id: "e" };
    expect(assessmentProgress(a, e, {})).toBe("uncorrected");
    expect(
      assessmentProgress(a, e, {
        assessment_results: [
          {
            id: "r",
            assessment_id: "a",
            enrollment_id: "e",
            attendance: "absent",
          },
        ],
      }),
    ).toBe("absent");
    expect(
      assessmentProgress(a, e, {
        assessment_results: [
          { id: "r", assessment_id: "a", enrollment_id: "e" },
        ],
      }),
    ).toBe("incomplete");
  });
  it("summarizes meaningful changes without technical counters", () =>
    expect(
      changedFields(
        { id: "x", first_name: "Prima", version: 1 },
        { id: "x", first_name: "Dopo", version: 2, updated_at: "today" },
      ),
    ).toEqual(["first_name"]));
});
