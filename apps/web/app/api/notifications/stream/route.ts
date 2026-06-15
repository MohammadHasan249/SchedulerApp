import { getApiUser as getUser, ApiAuthError } from "@/lib/auth/getUser";
import { db } from "@/lib/db";
import { employees, notifications } from "@scheduler/database/schema";
import { eq, and, gt } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Server-Sent Events stream for real-time notification delivery.
// The client opens this once; new notifications are pushed as they arrive.
// On disconnect the client should reconnect with Last-Event-ID set to the
// last notification id it received so it can catch up without a full fetch.
//
// Note: withAuth() wraps handlers to return NextResponse, but SSE requires a
// plain Response with a streaming body. Auth is handled inline here instead.
export async function GET(request: Request) {
  let user;
  try {
    user = await getUser();
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return new Response("Unauthorized", { status: 401 });
    }
    throw e;
  }

  const [emp] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.authUserId, user.id), eq(employees.organizationId, user.organizationId)))
    .limit(1);

  if (!emp) {
    return new Response("Employee profile not found", { status: 404 });
  }

  // The SSE event id is the notification's createdAt as epoch-ms, NOT its row id:
  // ids are random UUIDs (defaultRandom) with no chronological order, so a
  // "newer than last id" cursor would silently drop notifications whose UUID
  // happened to sort below the cursor. createdAt is monotonic, so it's a sound
  // cursor for both reconnect catch-up (Last-Event-ID) and the live poll below.
  const lastEventId = request.headers.get("Last-Event-ID") ?? undefined;
  const parsedLast = lastEventId ? Number(lastEventId) : NaN;
  let lastSeen: Date | undefined = Number.isFinite(parsedLast)
    ? new Date(parsedLast)
    : undefined;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(createdAt: Date, data: unknown) {
        controller.enqueue(
          encoder.encode(`id: ${createdAt.getTime()}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      // 1. Flush any missed notifications since the last event id.
      if (lastSeen) {
        const missed = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.employeeId, emp.id),
              eq(notifications.organizationId, user.organizationId),
              gt(notifications.createdAt, lastSeen)
            )
          )
          .orderBy(notifications.createdAt, notifications.id)
          .limit(50);

        for (const n of missed) {
          send(n.createdAt, n);
          lastSeen = n.createdAt;
        }
      }

      // 2. Send a heartbeat every 25 s to keep the connection alive through
      //    proxies that close idle HTTP/1.1 connections after 30 s.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      // 3. Poll for new notifications every 3 s. In production this should be
      //    replaced by Supabase Realtime (Postgres LISTEN/NOTIFY) so the DB
      //    isn't polled — the hook is in place, just swap the implementation.
      const poll = setInterval(async () => {
        try {
          const conditions = [
            eq(notifications.employeeId, emp.id),
            eq(notifications.organizationId, user.organizationId),
          ];
          if (lastSeen) conditions.push(gt(notifications.createdAt, lastSeen));

          const rows = await db
            .select()
            .from(notifications)
            .where(and(...conditions))
            .orderBy(notifications.createdAt, notifications.id)
            .limit(20);

          for (const n of rows) {
            send(n.createdAt, n);
            lastSeen = n.createdAt;
          }
        } catch {
          clearInterval(poll);
          clearInterval(heartbeat);
          try { controller.close(); } catch { /* already closed */ }
        }
      }, 3_000);

      // Clean up when the client disconnects.
      request.signal.addEventListener("abort", () => {
        clearInterval(poll);
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
