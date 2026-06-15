import { getZonedShiftWindow } from "@/lib/utils/timezone";

export type AvailabilitySchedule =
  | Record<string, { startTime: string; endTime: string }>
  | null
  | undefined;

/** "HH:MM" → minutes since midnight. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Manual / AI assignment semantics: an employee is BLOCKED only when they have
 * an availability slot for the shift's branch-local day AND the shift falls
 * outside it. No slot for that day = no stated constraint = allowed.
 *
 * All comparisons happen in the branch's timezone, not the server's.
 */
export function violatesAvailability(
  schedule: AvailabilitySchedule,
  shiftStart: Date,
  shiftEnd: Date,
  timezone: string
): { violates: boolean; slot?: { startTime: string; endTime: string } } {
  if (!schedule) return { violates: false };
  const { dayOfWeek, startMinutes, endMinutes } = getZonedShiftWindow(
    shiftStart,
    shiftEnd,
    timezone
  );
  const slot = schedule[String(dayOfWeek)];
  if (!slot) return { violates: false };
  const violates =
    startMinutes < toMinutes(slot.startTime) ||
    endMinutes > toMinutes(slot.endTime);
  return { violates, slot };
}

/**
 * Auto-assign semantics: an employee is AVAILABLE only when they have a slot for
 * the shift's branch-local day that fully covers it. No slot = not available.
 *
 * All comparisons happen in the branch's timezone, not the server's.
 */
export function coversAvailability(
  schedule: AvailabilitySchedule,
  shiftStart: Date,
  shiftEnd: Date,
  timezone: string
): boolean {
  if (!schedule) return false;
  const { dayOfWeek, startMinutes, endMinutes } = getZonedShiftWindow(
    shiftStart,
    shiftEnd,
    timezone
  );
  const slot = schedule[String(dayOfWeek)];
  if (!slot) return false;
  return (
    toMinutes(slot.startTime) <= startMinutes &&
    toMinutes(slot.endTime) >= endMinutes
  );
}
