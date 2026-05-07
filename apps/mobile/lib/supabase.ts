import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => {
    try {
      // Only store auth tokens, not the entire session object
      if (key === "sb-auth-token") {
        const parsed = JSON.parse(value);
        const minimal = {
          access_token: parsed.access_token,
          refresh_token: parsed.refresh_token,
          expires_in: parsed.expires_in,
          expires_at: parsed.expires_at,
          token_type: parsed.token_type,
        };
        return SecureStore.setItemAsync(key, JSON.stringify(minimal));
      }
      return SecureStore.setItemAsync(key, value);
    } catch {
      return SecureStore.setItemAsync(key, value);
    }
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
