import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  // GET is required here so a server-side redirect() (e.g. from the dashboard
  // layout's brand-mismatch gate) can drive the browser to this route. Guard
  // against logout-CSRF from a cross-site top-level navigation by rejecting
  // requests whose Sec-Fetch-Site says they didn't originate from this app.
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  const reason = new URL(request.url).searchParams.get("reason");
  const redirectUrl = new URL("/login", request.url);
  if (reason) redirectUrl.searchParams.set("reason", reason);
  return NextResponse.redirect(redirectUrl);
}
