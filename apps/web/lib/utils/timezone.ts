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
