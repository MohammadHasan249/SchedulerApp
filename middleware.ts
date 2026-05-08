import { type NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth-error"];

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);
  const { pathname, hostname } = request.nextUrl;

  // Extract org slug from subdomain (prod) or ?org= query param (dev)
  const orgSlug = resolveOrgSlug(hostname, request);
  if (orgSlug) {
    response.headers.set("x-org-slug", orgSlug);
  }

  // Kiosk is public — no auth required
  if (pathname.startsWith("/kiosk")) {
    return response;
  }

  // API routes handle their own auth — pass through without a session check
  if (pathname.startsWith("/api/")) {
    return response;
  }

  // Refresh session for page routes (required by @supabase/ssr)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (session && pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    if (session && (pathname.startsWith("/login") || pathname.startsWith("/signup"))) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return response;
  }

  // All other page routes require a session
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Settings pages are org_admin only
  if (pathname.startsWith("/settings") && session.user.app_metadata?.role !== "org_admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

function resolveOrgSlug(hostname: string, request: NextRequest): string | null {
  const parts = hostname.split(".");
  if (parts.length >= 3 && parts[0] !== "www" && parts[0] !== "app") {
    return parts[0];
  }
  return request.nextUrl.searchParams.get("org");
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
