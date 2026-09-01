import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Auto-captures errors thrown from Server Components and Route Handlers —
// without this, only client-side render errors (caught in app/error.tsx)
// ever reach Sentry.
export const onRequestError = Sentry.captureRequestError;
