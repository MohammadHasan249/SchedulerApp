import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { consumeFreshInstall } from "@/lib/clearStaleKeychain";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Supabase uses storage keys like `sb-<project-ref>-auth-token`. Match by
// prefix/suffix so we actually strip the session blob down to the tokens we
// need (iOS SecureStore has a ~2 KB per-key limit).
export function isAuthTokenKey(key: string): boolean {
  return key.startsWith("sb-") && key.endsWith("-auth-token");
}

// `consumeFreshInstall()` resolves the same true/false answer to every
// caller for the whole process lifetime (see clearStaleKeychain.ts) — it
// does NOT go true-then-false on its own. Without gating below, every read
// of the auth-token key on a fresh install (including the one right after
// the user's very first login, once a real session has just been written)
// would see "fresh install" as still true and wipe the token it's supposed
// to be reading, turning a successful login into an immediate 401.
//
// Memoized as a single awaited promise (not a boolean flag) so concurrent
// reads of the key — e.g. supabase-js's own init read racing our root
// layout's getSession() call, both at app boot — all wait for the same
// in-flight delete to actually finish before falling through to a real
// read, instead of a second caller slipping past mid-delete and returning
// the stale pre-reinstall token.
let freshInstallPurge: Promise<void> | null = null;

export const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    // iOS Keychain entries survive an app reinstall, unlike the rest of the
    // app's storage. On a fresh install, deny the very first read of the
    // auth token so a reinstall can't silently resume a previous session.
    if (isAuthTokenKey(key)) {
      if (!freshInstallPurge) {
        freshInstallPurge = Promise.resolve(consumeFreshInstall()).then((isFresh) => {
          if (!isFresh) return;
          return Promise.resolve(SecureStore.deleteItemAsync(key)).then(
            () => {},
            () => {}
          );
        });
      }
      await freshInstallPurge;
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    if (isAuthTokenKey(key)) {
      try {
        const parsed = JSON.parse(value);
        const minimal = {
          access_token: parsed.access_token,
          refresh_token: parsed.refresh_token,
          expires_in: parsed.expires_in,
          expires_at: parsed.expires_at,
          token_type: parsed.token_type,
        };
        return SecureStore.setItemAsync(key, JSON.stringify(minimal));
      } catch {
        // Malformed JSON — fall through to storing the raw value.
      }
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
