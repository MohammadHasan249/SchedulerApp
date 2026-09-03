import type { StreamTextTransform, TextStreamPart, ToolSet } from "ai";

// Handles look like "shift_1", "employee_5", etc. — see toHandle() in
// schedule-tools.ts. The system prompt already tells the model never to say
// these out loud, but it doesn't reliably comply (confirmed: it echoed
// "shift_5"/"employee_5" directly into chat replies during testing). This is
// a server-side backstop so a handle can never reach the client regardless
// of what the model does — redacted to just the entity word ("shift_5" ->
// "shift") so the sentence still reads naturally.
const HANDLE_PATTERN = /\b(shift|branch|assignment|employee|role)_\d+\b/g;

// Must be long enough that no possible handle match (longest prefix
// "assignment" + "_" + digits) can span a held-back tail and the next delta
// without ever being complete inside the tail alone.
const SAFE_TAIL_LENGTH = 32;

function redact(text: string): string {
  return text.replace(HANDLE_PATTERN, (_match, prefix: string) => prefix);
}

/**
 * Buffers each text block's tail by a few characters so a handle split
 * across two model-generated chunks (e.g. "shift_" then "5") still gets
 * caught, then redacts and forwards. Non-text parts pass through untouched.
 */
export function redactHandlesTransform<TOOLS extends ToolSet>(): StreamTextTransform<TOOLS> {
  return () => {
    const pending = new Map<string, string>();

    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(part, controller) {
        if (part.type === "text-delta") {
          const combined = (pending.get(part.id) ?? "") + part.text;
          const safeLength = Math.max(0, combined.length - SAFE_TAIL_LENGTH);
          const toEmit = combined.slice(0, safeLength);
          pending.set(part.id, combined.slice(safeLength));
          if (toEmit) {
            controller.enqueue({ ...part, text: redact(toEmit) });
          }
          return;
        }

        if (part.type === "text-end") {
          const remaining = pending.get(part.id);
          if (remaining) {
            controller.enqueue({ type: "text-delta", id: part.id, text: redact(remaining) } as TextStreamPart<TOOLS>);
            pending.delete(part.id);
          }
        }

        controller.enqueue(part);
      },
    });
  };
}
