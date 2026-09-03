import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/**
 * Wall-clock parts of a UTC instant as seen in a given IANA timezone, computed
 * explicitly (independent of the server's own timezone).
 *
 * - `dayOfWeek`: 0 (Sun) – 6 (Sat), matching JS `Date.getDay()`.
 * - `minutesOfDay`: minutes since local midnight (0–1439).
 * - `dateStr`: local calendar date as "YYYY-MM-DD".
 */
export function getZonedParts(
  at: Date,
  timezone: string
): { dayOfWeek: number; minutesOfDay: number; dateStr: string } {
  // date-fns 'i' token = ISO day of week, 1 (Mon) – 7 (Sun). Map to 0–6 (Sun–Sat).
  const isoDow = Number(formatInTimeZone(at, timezone, "i"));
  const dayOfWeek = isoDow % 7;
  const hh = Number(formatInTimeZone(at, timezone, "HH"));
  const mm = Number(formatInTimeZone(at, timezone, "mm"));
  return {
    dayOfWeek,
    minutesOfDay: hh * 60 + mm,
    dateStr: formatInTimeZone(at, timezone, "yyyy-MM-dd"),
  };
}

/**
 * Projects a shift (UTC start/end) onto the branch-local wall clock for
 * availability comparison.
 *
 * `endMinutes` is measured from the START day's local midnight, so a shift that
 * crosses local midnight yields `endMinutes >= 1440`. Single-day availability
 * windows (max 1439) therefore never "cover" an overnight shift — the caller
 * conservatively treats it as outside availability, which is the sensible
 * default for a per-day availability model.
 */
export function getZonedShiftWindow(
  start: Date,
  end: Date,
  timezone: string
): { dayOfWeek: number; startMinutes: number; endMinutes: number } {
  const s = getZonedParts(start, timezone);
  const e = getZonedParts(end, timezone);
  // Whole-day difference between the two local calendar dates (UTC-parsed so the
  // diff is exact days regardless of month/DST boundaries).
  const dayDiff = Math.round(
    (Date.parse(e.dateStr) - Date.parse(s.dateStr)) / 86_400_000
  );
  return {
    dayOfWeek: s.dayOfWeek,
    startMinutes: s.minutesOfDay,
    endMinutes: e.minutesOfDay + dayDiff * 1440,
  };
}

/**
 * Formats a UTC instant as a 12-hour wall-clock time (e.g. "2:30 PM") in the
 * given IANA timezone. Use for all shift/clock/notification time displays.
 */
export function formatZonedTime(at: Date | string, timezone: string): string {
  return formatInTimeZone(new Date(at), timezone, "h:mm a");
}

/**
 * Formats a UTC instant as a short date + 12-hour wall-clock time (e.g.
 * "Jun 1, 2:30 PM") in the given IANA timezone.
 */
export function formatZonedDateTime(at: Date | string, timezone: string): string {
  return formatInTimeZone(new Date(at), timezone, "MMM d, h:mm a");
}

/**
 * Same as `formatZonedDateTime` but with the weekday spelled out (e.g.
 * "Thursday, Sep 3, 2:30 PM"). Use anywhere a reader needs to reason about
 * day-of-week without recomputing it themselves — notably the AI schedule
 * agent's system prompt, which otherwise leaves the model to infer the
 * weekday from the date on its own and gets it wrong.
 */
export function formatZonedDateTimeWithWeekday(at: Date | string, timezone: string): string {
  return formatInTimeZone(new Date(at), timezone, "EEEE, MMM d, h:mm a");
}

/**
 * Converts a naive local wall-clock string (e.g. "2026-06-01T09:00:00", no
 * offset) as read in the given IANA timezone into the UTC instant it
 * represents. Use when a caller (e.g. an LLM tool argument) supplies a
 * branch-local time rather than an absolute instant.
 */
export function zonedTimeToUtc(localDateTime: string, timezone: string): Date {
  return fromZonedTime(localDateTime, timezone);
}

/**
 * Returns the UTC instant that represents 00:00:00 of today in the given IANA
 * timezone. The server's own timezone is irrelevant.
 *
 * Example: now is 2026-05-31T23:30:00Z, timezone is "Asia/Tokyo" (+09:00).
 * Local wall clock in Tokyo is 2026-06-01T08:30:00; Tokyo midnight is
 * 2026-05-31T15:00:00Z. That UTC instant is what we return.
 */
export function getZonedDayStart(timezone: string, at: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(at);

  const lookup: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") lookup[p.type] = p.value;
  }

  const y = Number(lookup.year);
  const mo = Number(lookup.month);
  const d = Number(lookup.day);
  // Intl reports "24" for midnight in some zones; normalize to 0.
  const h = Number(lookup.hour) % 24;
  const mi = Number(lookup.minute);
  const s = Number(lookup.second);

  // Pretend wall-clock-in-zone is UTC to get a "naive" timestamp, then derive
  // the zone offset from the real now and apply it to that day's midnight.
  const naiveNowMs = Date.UTC(y, mo - 1, d, h, mi, s);
  const offsetMs = at.getTime() - naiveNowMs;

  const naiveMidnightMs = Date.UTC(y, mo - 1, d, 0, 0, 0);
  return new Date(naiveMidnightMs + offsetMs);
}

/**
 * Returns the UTC instant of 00:00:00 on the day that starts the branch-local
 * week containing `at`. Defaults to Sunday (`weekStartsOn: 0`) — used for
 * weekly-hours-cap boundaries so they line up with the same branch timezone
 * availability/time-off checks already use, instead of the server's own
 * timezone (Vercel runs UTC). Pass `weekStartsOn: 1` for a Monday-starting
 * week (e.g. the schedule UI, which displays Mon–Sun).
 *
 * Walks back one local calendar day at a time — via `getZonedDayStart`, not a
 * fixed 24h subtraction — so the result stays correct across a DST transition
 * that falls inside the same week.
 */
export function getZonedWeekStart(
  timezone: string,
  at: Date = new Date(),
  weekStartsOn: 0 | 1 = 0
): Date {
  const { dayOfWeek } = getZonedParts(at, timezone);
  const daysSinceWeekStart = (dayOfWeek - weekStartsOn + 7) % 7;
  let cursor = getZonedDayStart(timezone, at);
  for (let i = 0; i < daysSinceWeekStart; i++) {
    // 12h before local midnight is guaranteed to still fall on the previous
    // local calendar day, even when that day was a 23h or 25h DST day.
    const prevLocalDay = new Date(cursor.getTime() - 12 * 60 * 60 * 1000);
    cursor = getZonedDayStart(timezone, prevLocalDay);
  }
  return cursor;
}
