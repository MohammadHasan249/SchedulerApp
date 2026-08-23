import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Supabase uses storage keys like `sb-<project-ref>-auth-token`. Match by
// prefix/suffix so we actually strip the session blob down to the tokens we
// need (iOS SecureStore has a ~2 KB per-key limit).
export function isAuthTokenKey(key: string): boolean {
  return key.startsWith("sb-") && key.endsWith("-auth-token");
}

export const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
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
