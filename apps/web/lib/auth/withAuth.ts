import { NextResponse } from "next/server";
import { ApiAuthError } from "./getUser";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withAuth<T extends (...args: any[]) => Promise<NextResponse>>(handler: T): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (e) {
      if (e instanceof ApiAuthError) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      throw e;
    }
  }) as T;
}
