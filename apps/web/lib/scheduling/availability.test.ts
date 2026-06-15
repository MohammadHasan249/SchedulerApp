import { describe, it, expect } from "vitest";
import { getZonedParts, getZonedShiftWindow } from "@/lib/utils/timezone";
import { coversAvailability, violatesAvailability } from "./availability";

// 2026-06-15T02:00:00Z is a Monday in UTC, but in America/New_York (EDT, -04:00)
// the wall clock is Sunday 2026-06-14 22:00 — a different day AND day-of-week.
// These tests pin that down so availability is evaluated in the branch's zone,
// not the server's. They're deterministic regardless of the machine's TZ.
const NY = "America/New_York";

describe("getZonedParts", () => {
  it("derives branch-local day/date, not UTC", () => {
    const at = new Date("2026-06-15T02:00:00Z");
    expect(getZonedParts(at, "UTC")).toEqual({
      dayOfWeek: 1, // Monday
      minutesOfDay: 120, // 02:00
      dateStr: "2026-06-15",
    });
    expect(getZonedParts(at, NY)).toEqual({
      dayOfWeek: 0, // Sunday
      minutesOfDay: 1320, // 22:00
      dateStr: "2026-06-14",
    });
  });
});

describe("getZonedShiftWindow", () => {
  it("projects start/end onto branch-local minutes", () => {
    const start = new Date("2026-06-15T02:00:00Z");
    const end = new Date("2026-06-15T03:00:00Z");
    expect(getZonedShiftWindow(start, end, "UTC")).toEqual({
      dayOfWeek: 1,
      startMinutes: 120,
      endMinutes: 180,
    });
    // NY: Sunday 22:00–23:00.
    expect(getZonedShiftWindow(start, end, NY)).toEqual({
      dayOfWeek: 0,
      startMinutes: 1320,
      endMinutes: 1380,
    });
  });

  it("represents a shift crossing local midnight with endMinutes >= 1440", () => {
    // NY: Sunday 21:00 -> Monday 01:00.
    const start = new Date("2026-06-15T01:00:00Z");
    const end = new Date("2026-06-15T05:00:00Z");
    expect(getZonedShiftWindow(start, end, NY)).toEqual({
      dayOfWeek: 0, // start day (Sunday)
      startMinutes: 1260, // 21:00
      endMinutes: 1500, // 01:00 next day -> 60 + 1440
    });
  });
});

describe("coversAvailability (auto-assign semantics)", () => {
  const start = new Date("2026-06-15T02:00:00Z");
  const end = new Date("2026-06-15T03:00:00Z");
  // Employee available Sunday night (branch-local).
  const schedule = { "0": { startTime: "21:00", endTime: "23:30" } };

  it("is available when the slot covers the shift in branch time", () => {
    expect(coversAvailability(schedule, start, end, NY)).toBe(true);
  });

  it("would wrongly miss the employee if evaluated in UTC (the bug)", () => {
    // In UTC the shift is Monday, for which there is no slot.
    expect(coversAvailability(schedule, start, end, "UTC")).toBe(false);
  });

  it("never covers an overnight shift with a single-day slot", () => {
    const oStart = new Date("2026-06-15T01:00:00Z"); // NY Sun 21:00
    const oEnd = new Date("2026-06-15T05:00:00Z"); // NY Mon 01:00
    const wide = { "0": { startTime: "20:00", endTime: "23:59" } };
    expect(coversAvailability(wide, oStart, oEnd, NY)).toBe(false);
  });

  it("is not available with no schedule", () => {
    expect(coversAvailability(null, start, end, NY)).toBe(false);
    expect(coversAvailability({}, start, end, NY)).toBe(false);
  });
});

describe("violatesAvailability (manual/AI semantics)", () => {
  const start = new Date("2026-06-15T02:00:00Z"); // NY Sun 22:00
  const end = new Date("2026-06-15T03:00:00Z"); // NY Sun 23:00

  it("does not block when the day has no slot (no stated constraint)", () => {
    // Only Monday is restricted; in NY the shift is Sunday -> allowed.
    const schedule = { "1": { startTime: "09:00", endTime: "17:00" } };
    expect(violatesAvailability(schedule, start, end, NY).violates).toBe(false);
  });

  it("would wrongly block if evaluated in UTC (the bug)", () => {
    // In UTC the shift maps to Monday 02:00–03:00, outside 09:00–17:00.
    const schedule = { "1": { startTime: "09:00", endTime: "17:00" } };
    expect(violatesAvailability(schedule, start, end, "UTC").violates).toBe(true);
  });

  it("blocks when the shift falls outside that day's branch-local window", () => {
    // NY Sunday slot ends at 22:30, shift runs to 23:00 -> outside.
    const schedule = { "0": { startTime: "08:00", endTime: "22:30" } };
    const res = violatesAvailability(schedule, start, end, NY);
    expect(res.violates).toBe(true);
    expect(res.slot).toEqual({ startTime: "08:00", endTime: "22:30" });
  });
});
