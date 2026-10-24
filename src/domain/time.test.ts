import { describe, it, expect } from "vitest";
import {
  romeInstant,
  romeLocal,
  italianDate,
  italianDateTime,
  italianDateValue,
} from "./time";
describe("Rome lesson editor", () => {
  it("converts winter and summer independently of browser timezone", () => {
    expect(romeInstant("2026-01-10T09:00")).toBe("2026-01-10T08:00:00.000Z");
    expect(romeInstant("2026-07-10T09:00")).toBe("2026-07-10T07:00:00.000Z");
  });
  it("prepopulates existing UTC timestamps in Rome", () =>
    expect(romeLocal("2026-07-10T22:30:00Z")).toBe("2026-07-11T00:30"));
  it("preserves an initial wall clock value", () =>
    expect(romeLocal("2026-07-10T09:00")).toBe("2026-07-10T09:00"));
  it("rejects nonexistent spring clock time", () =>
    expect(() => romeInstant("2026-03-29T02:30")).toThrow("inesistente"));
  it("requires an unambiguous autumn clock time", () =>
    expect(() => romeInstant("2026-10-25T02:30")).toThrow("ambigua"));
  it("accepts times after both clock changes", () => {
    expect(romeInstant("2026-03-29T03:30")).toBe("2026-03-29T01:30:00.000Z");
    expect(romeInstant("2026-10-25T03:30")).toBe("2026-10-25T02:30:00.000Z");
  });
});
describe("Italian date display", () => {
  it("uses padded day/month/year without moving date-only values", () => {
    expect(italianDate("2026-01-05")).toBe("05/01/2026");
    expect(italianDate("2024-02-29")).toBe("29/02/2024");
  });
  it("uses Rome dates and times across midnight in winter and summer", () => {
    expect(italianDate("2026-01-01T23:30:00Z")).toBe("02/01/2026");
    expect(italianDateTime("2026-07-10T22:30:00Z")).toBe("11/07/2026 00:30");
    expect(italianDateTime("2026-01-10T09:00")).toBe("10/01/2026 09:00");
  });
  it("keeps optional fields empty and preserves ordinary text", () => {
    expect(italianDate(null)).toBe("");
    expect(italianDate("")).toBe("");
    expect(italianDate("In corso")).toBe("In corso");
    expect(italianDate("2026-02-30")).toBe("");
    expect(italianDateTime("2026-02-30T12:00:00Z")).toBe("");
  });
  it("formats export dates without changing the input data or ordinary strings", () => {
    const input = "2026-10-25";
    expect(italianDateValue(input)).toBe("25/10/2026");
    expect(input).toBe("2026-10-25");
    expect(italianDateValue("2026/2027")).toBe("2026/2027");
  });
});
