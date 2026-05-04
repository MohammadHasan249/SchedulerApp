import { configureApiClient } from "@scheduler/api-client";
import { supabase } from "./supabase";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL!;

configureApiClient({
  baseUrl: API_BASE_URL,
  getToken: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
});

export * from "@scheduler/api-client";
