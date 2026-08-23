// supabase.ts reads these at module load time, so they must be set before it's imported.
process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-anon-key";

import * as SecureStore from "expo-secure-store";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const { isAuthTokenKey, ExpoSecureStoreAdapter } = require("../supabase");

describe("isAuthTokenKey", () => {
  it("matches Supabase's sb-<project-ref>-auth-token format", () => {
    expect(isAuthTokenKey("sb-abcdef-auth-token")).toBe(true);
  });

  it("rejects keys that don't match the prefix/suffix", () => {
    expect(isAuthTokenKey("auth-token")).toBe(false);
    expect(isAuthTokenKey("sb-abcdef-refresh-token")).toBe(false);
    expect(isAuthTokenKey("something-else")).toBe(false);
  });
});

describe("ExpoSecureStoreAdapter.setItem", () => {
  beforeEach(() => jest.clearAllMocks());

  it("strips a full session blob down to just the tokens for an auth-token key (iOS 2KB limit)", async () => {
    const fullSession = {
      access_token: "at",
      refresh_token: "rt",
      expires_in: 3600,
      expires_at: 123,
      token_type: "bearer",
      user: { id: "u1", email: "a@b.com", app_metadata: { role: "employee" } },
    };

    await ExpoSecureStoreAdapter.setItem("sb-myproj-auth-token", JSON.stringify(fullSession));

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "sb-myproj-auth-token",
      JSON.stringify({ access_token: "at", refresh_token: "rt", expires_in: 3600, expires_at: 123, token_type: "bearer" })
    );
  });

  it("stores non-auth-token keys unmodified", async () => {
    await ExpoSecureStoreAdapter.setItem("some-other-key", "raw-value");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("some-other-key", "raw-value");
  });

  it("falls back to storing the raw value if the auth-token value isn't valid JSON", async () => {
    await ExpoSecureStoreAdapter.setItem("sb-myproj-auth-token", "not-json");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("sb-myproj-auth-token", "not-json");
  });
});
