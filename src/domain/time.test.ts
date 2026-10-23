import { describe, it, expect } from "vitest";
import { romeInstant, romeLocal } from "./time";
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
