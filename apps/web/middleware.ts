import { NextRequest, NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Paths that are intentionally public (kiosk clock-in, org/employee signup).
// These accept POST from non-browser clients (mobile app, kiosk device) so
// Origin validation must not apply.
const CSRF_EXEMPT = new Set([
  "/api/clock",
  "/api/auth/employee-signup",
  "/api/org",
]);

export function middleware(request: NextRequest) {
  const { pathname, origin: requestOrigin } = new URL(request.url);

  // Only validate state-changing requests to /api routes.
  if (!SAFE_METHODS.has(request.method) && pathname.startsWith("/api")) {
    if (!CSRF_EXEMPT.has(pathname)) {
      const originHeader = request.headers.get("origin");
      const hostHeader = request.headers.get("host");

      if (originHeader && hostHeader) {
        const originHost = new URL(originHeader).host;
        if (originHost !== hostHeader) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
