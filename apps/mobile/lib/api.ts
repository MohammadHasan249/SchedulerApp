import { configureApiClient } from "@scheduler/api-client";
import * as Sentry from "@sentry/react-native";
import { supabase } from "./supabase";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL!;

configureApiClient({
  baseUrl: API_BASE_URL,
  getToken: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
  refreshToken: async () => {
    const { data } = await supabase.auth.refreshSession();
    if (data.session?.access_token) return data.session.access_token;

    // The refresh failed (revoked/expired session) — sign out locally so
    // `onAuthStateChange` fires SIGNED_OUT and the app redirects to login
    // right away. Without this, the app just silently fails this one request
    // and waits on the SDK's own autoRefreshToken background timer to
    // eventually notice the same dead session on its own schedule, which can
    // take a while (that timer runs independently of this request path).
    // `scope: "local"` skips the network call to revoke server-side — the
    // session is already dead there, only local state needs clearing.
    await supabase.auth.signOut({ scope: "local" });
    return null;
  },
  onError: (error, path) => {
    Sentry.captureException(error, { extra: { path } });
  },
});

export * from "@scheduler/api-client";
