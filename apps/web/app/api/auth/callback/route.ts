import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Only allow same-origin relative redirects. Reject protocol-relative ("//evil.com"),
// absolute URLs, and anything that isn't a single leading slash — these were
// otherwise an open-redirect pivot for phishing flows after OAuth.
function safeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/")) return "/dashboard";
  if (raw.startsWith("//")) return "/dashboard";
  if (raw.startsWith("/\\")) return "/dashboard";
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth-error`);
}
