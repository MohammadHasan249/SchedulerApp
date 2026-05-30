/**
 * Render an API error response into a readable user-facing string.
 *
 * The server returns Zod validation errors as `error.flatten()` which is an
 * object shaped `{ formErrors: string[], fieldErrors: Record<string, string[]> }`.
 * Naively rendering that as a string yields "[object Object]" — this helper
 * walks it and produces the most specific message it can.
 */
export function extractErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;

  if (typeof error === "object") {
    const e = error as {
      formErrors?: string[];
      fieldErrors?: Record<string, string[]>;
    };
    if (Array.isArray(e.formErrors) && e.formErrors.length > 0) {
      return e.formErrors[0];
    }
    if (e.fieldErrors) {
      const firstField = Object.values(e.fieldErrors).find(
        (msgs) => Array.isArray(msgs) && msgs.length > 0
      );
      if (firstField) return firstField[0];
    }
  }

  return fallback;
}
