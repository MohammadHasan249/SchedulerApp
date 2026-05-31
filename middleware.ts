import { type NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth-error"];

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);
  const { pathname } = request.nextUrl;

  // Kiosk is public — no auth required
  if (pathname.startsWith("/kiosk")) {
    return response;
  }

  // API routes handle their own auth — pass through without a session check
  if (pathname.startsWith("/api/")) {
    return response;
  }

  // getUser() makes a server-side call that validates the JWT signature.
  // getSession() only reads from cookies, so a tampered cookie claiming
  // app_metadata.role = "org_admin" would be trusted by the route guards
  // below. The extra round-trip is the documented secure pattern.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (user && pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    if (user && (pathname.startsWith("/login") || pathname.startsWith("/signup"))) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return response;
  }

  // All other page routes require a session
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Settings pages are org_admin only
  if (pathname.startsWith("/settings") && user.app_metadata?.role !== "org_admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
