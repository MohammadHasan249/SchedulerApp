import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  // Force HTTPS for two years and pre-load. Safe to commit because Vercel
  // serves the production domain over HTTPS unconditionally.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Stop browsers from MIME-sniffing responses (defense against polyglot files).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No-one should ever frame this app — kiosk-style usage and admin pages
  // should never appear in an iframe.
  { key: "X-Frame-Options", value: "DENY" },
  // Trim the Referer header on cross-origin nav so we don't leak path info.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Drop powerful features the app doesn't use; cookies are not deprecated.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
