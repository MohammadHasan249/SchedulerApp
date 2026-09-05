import { apiFetch } from "./client";

export type MobileLoginResult = {
  access_token: string;
  refresh_token: string;
};

/**
 * Server-side login for the mobile app — unlike a direct Supabase
 * `signInWithPassword`, the server checks `appVariant` against the
 * employee's organization and rejects a brand mismatch (e.g. a Seau de
 * Crabe employee opening the Workplix build) before any session is issued,
 * rather than letting the client sign in and then sign itself back out.
 */
export function mobileLogin(
  email: string,
  password: string,
  appVariant: "workplix" | "seaudecrabe"
): Promise<MobileLoginResult> {
  return apiFetch("/api/auth/mobile-login", {
    method: "POST",
    body: JSON.stringify({ email, password, appVariant }),
  });
}
