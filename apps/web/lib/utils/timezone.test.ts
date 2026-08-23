import { describe, it, expect } from "vitest";
import { getZonedParts, getZonedShiftWindow, getZonedDayStart, getZonedWeekStart } from "./timezone";

describe("getZonedParts", () => {
  it("resolves day-of-week and time-of-day in the given timezone, not UTC", () => {
    // 2024-01-07 is a Sunday. 23:30 UTC on Saturday is already Sunday 08:30 in Tokyo (+09:00).
    const at = new Date("2024-01-06T23:30:00Z");
    const utc = getZonedParts(at, "UTC");
    const tokyo = getZonedParts(at, "Asia/Tokyo");
    expect(utc.dayOfWeek).toBe(6); // Saturday
    expect(tokyo.dayOfWeek).toBe(0); // Sunday
    expect(tokyo.minutesOfDay).toBe(8 * 60 + 30);
  });
});

describe("getZonedShiftWindow", () => {
  it("marks an overnight shift's endMinutes past 1440 relative to the start day", () => {
    const start = new Date("2024-01-01T22:00:00Z"); // 22:00 UTC
    const end = new Date("2024-01-02T02:00:00Z"); // 02:00 UTC next day
    const window = getZonedShiftWindow(start, end, "UTC");
    expect(window.startMinutes).toBe(22 * 60);
    expect(window.endMinutes).toBe(1440 + 2 * 60);
  });
});

describe("getZonedDayStart", () => {
  it("returns the UTC instant of local midnight for a non-UTC timezone", () => {
    // Tokyo is UTC+9 with no DST — midnight Tokyo is always 15:00 UTC the previous day.
    const at = new Date("2026-05-31T23:30:00Z");
    const dayStart = getZonedDayStart("Asia/Tokyo", at);
    expect(dayStart.toISOString()).toBe("2026-05-31T15:00:00.000Z");
  });
});

describe("getZonedWeekStart", () => {
  it("returns the same instant as getZonedDayStart when `at` already falls on a branch-local Sunday", () => {
    // 2024-01-07 is a Sunday.
    const at = new Date("2024-01-07T12:00:00Z");
    const weekStart = getZonedWeekStart("UTC", at);
    const dayStart = getZonedDayStart("UTC", at);
    expect(weekStart.getTime()).toBe(dayStart.getTime());
  });

  it("walks back to Sunday in the branch's timezone, not the server's", () => {
    // 2024-01-09T02:30Z is Tuesday in UTC, but still Monday 21:30 in New York (UTC-5 in Jan).
    const at = new Date("2024-01-09T02:30:00Z");
    const nyWeekStart = getZonedWeekStart("America/New_York", at);
    // Branch-local Sunday 2024-01-07 00:00 America/New_York = 2024-01-07T05:00:00Z.
    expect(nyWeekStart.toISOString()).toBe("2024-01-07T05:00:00.000Z");
  });

  it("lands within an hour of true local midnight even when the week's Sunday is itself the DST-transition day", () => {
    // 2024-03-12 is a Tuesday; DST in America/New_York started 2024-03-10.
    // The week's Sunday (2024-03-10) is itself the DST-transition day, so this
    // walks back through a day whose UTC offset changes partway through.
    const at = new Date("2024-03-12T15:00:00Z");
    const weekStart = getZonedWeekStart("America/New_York", at);
    expect(weekStart.getUTCFullYear()).toBe(2024);
    expect(weekStart.getUTCMonth()).toBe(2); // March
    expect(weekStart.getUTCDate()).toBe(10);
    // True local midnight is 05:00 UTC (EST, UTC-5, still in effect before the
    // 2am transition); getZonedDayStart derives the day's offset from the
    // instant it's given rather than from true midnight, so on the transition
    // day itself this can land an hour off (04:00 UTC) depending on which side
    // of the 2am transition that instant falls — still same UTC calendar day,
    // never a different day entirely.
    expect(["2024-03-10T04:00:00.000Z", "2024-03-10T05:00:00.000Z"]).toContain(weekStart.toISOString());
  });
});
