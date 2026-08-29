import { formatInTimeZone } from "date-fns-tz";

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
