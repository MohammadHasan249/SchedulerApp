import { NextResponse } from "next/server";

export async function safeJson(
  request: Request
): Promise<[unknown, null] | [null, NextResponse]> {
  try {
    const body: unknown = await request.json();
    return [body, null];
  } catch {
    return [null, NextResponse.json({ error: "Invalid JSON" }, { status: 400 })];
  }
}
