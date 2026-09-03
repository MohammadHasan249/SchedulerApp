import { describe, it, expect } from "vitest";
import type { TextStreamPart, ToolSet } from "ai";
import { redactHandlesTransform } from "./redact-handles-transform";

type Part = TextStreamPart<ToolSet>;

async function run(parts: Part[]): Promise<Part[]> {
  const transform = redactHandlesTransform<ToolSet>()({ tools: {}, stopStream: () => {} });
  const writer = transform.writable.getWriter();
  const reader = transform.readable.getReader();

  const outPromise = (async () => {
    const out: Part[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return out;
      out.push(value);
    }
  })();

  for (const part of parts) await writer.write(part);
  await writer.close();
  return outPromise;
}

function textDelta(id: string, text: string): Part {
  return { type: "text-delta", id, text };
}

function textEnd(id: string): Part {
  return { type: "text-end", id };
}

async function collectText(parts: Part[]): Promise<string> {
  const out = await run(parts);
  return out
    .filter((p): p is Extract<Part, { type: "text-delta" }> => p.type === "text-delta")
    .map((p) => p.text)
    .join("");
}

describe("redactHandlesTransform", () => {
  it("redacts a handle fully contained in one chunk", async () => {
    const text = await collectText([
      textDelta("1", "Assigned to shift_5 for employee_3."),
      textEnd("1"),
    ]);
    expect(text).toBe("Assigned to shift for employee.");
  });

  it("redacts a handle split across chunk boundaries", async () => {
    const text = await collectText([
      textDelta("1", "The reference is shift_"),
      textDelta("1", "12 for this booking."),
      textEnd("1"),
    ]);
    expect(text).toBe("The reference is shift for this booking.");
  });

  it("leaves ordinary text untouched", async () => {
    const text = await collectText([
      textDelta("1", "Mohammad is assigned to the evening shift on Sep 5."),
      textEnd("1"),
    ]);
    expect(text).toBe("Mohammad is assigned to the evening shift on Sep 5.");
  });

  it("passes non-text parts through unchanged", async () => {
    const finishPart: Part = { type: "finish", finishReason: "stop", rawFinishReason: undefined, totalUsage: {} as never };
    const out = await run([textDelta("1", "ok employee_1"), textEnd("1"), finishPart]);
    expect(out.some((p) => p.type === "finish")).toBe(true);
    const text = out
      .filter((p): p is Extract<Part, { type: "text-delta" }> => p.type === "text-delta")
      .map((p) => p.text)
      .join("");
    expect(text).toBe("ok employee");
  });

  it("keeps distinct text blocks independent", async () => {
    const out = await run([
      textDelta("a", "shift_1"),
      textDelta("b", "employee_2"),
      textEnd("a"),
      textEnd("b"),
    ]);
    const byId = (id: string) =>
      out
        .filter((p): p is Extract<Part, { type: "text-delta" }> => p.type === "text-delta" && p.id === id)
        .map((p) => p.text)
        .join("");
    expect(byId("a")).toBe("shift");
    expect(byId("b")).toBe("employee");
  });
});
