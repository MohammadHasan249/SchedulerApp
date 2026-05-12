import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size: sizeParam } = await params;
  const size = parseInt(sizeParam) || 192;
  const { searchParams } = new URL(request.url);
  const color = searchParams.get("color") ?? "#3b82f6";

  // If the org has uploaded a logo, redirect to it — validate host to prevent open redirect.
  const logo = searchParams.get("logo");
  if (logo) {
    try {
      const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host;
      const logoHost = new URL(logo).host;
      if (logoHost === supabaseHost || logoHost.endsWith(`.${supabaseHost}`)) {
        return Response.redirect(logo, 302);
      }
    } catch {
      // malformed URL — fall through to generated icon
    }
  }
  const radius = Math.round(size * 0.2);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          background: color,
          borderRadius: radius,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Calendar icon */}
        <svg
          width={size * 0.6}
          height={size * 0.6}
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
    ),
    { width: size, height: size }
  );
}
