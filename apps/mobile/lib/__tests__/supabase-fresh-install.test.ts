// Isolated from supabase.test.ts on purpose: these tests need full control
// over module load order (mocks configured before the Supabase client's own
// internal init reads the auth-token key), which a shared file-level
// jest.mock/import would interfere with.

// supabase.ts reads these at module load time.
process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-anon-key";

describe("ExpoSecureStoreAdapter.getItem — fresh install handling", () => {
  // consumeFreshInstall() resolves the SAME answer to every caller for the
  // whole process — it doesn't flip to false after the first call. A fresh
  // install's very first read of the auth-token key (which happens as soon
  // as the Supabase client is constructed, before any of our own code runs)
  // must wipe any stale token, but a login that happens moments later in
  // the same process must NOT have its brand-new, just-written token wiped
  // by that same still-true "fresh install" signal on the next read.
  it("wipes the token on its own first read of a fresh install, but not on later reads in the same process", async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock("expo-secure-store", () => ({
        getItemAsync: jest.fn().mockResolvedValue("real-session-written-after-login"),
        setItemAsync: jest.fn(),
        deleteItemAsync: jest.fn(),
      }));
      jest.doMock("@/lib/clearStaleKeychain", () => ({
        consumeFreshInstall: jest.fn().mockResolvedValue(true),
      }));

      const SecureStoreLocal = require("expo-secure-store");
      const { ExpoSecureStoreAdapter: Adapter } = require("../supabase");

      // The Supabase client's own internal init reads the auth-token key
      // immediately on construction — that race is the one real callers
      // hit too, so let it run before making our own explicit call.
      await new Promise((resolve) => setImmediate(resolve));

      // The client's own internal init already applied the fresh-install
      // wipe by this point (asserted via the one earlier delete call).
      expect(SecureStoreLocal.deleteItemAsync).toHaveBeenCalledTimes(1);

      const explicitRead = await Adapter.getItem("sb-myproj-auth-token");
      expect(explicitRead).toBe("real-session-written-after-login");
      // The explicit call must NOT trigger a second wipe.
      expect(SecureStoreLocal.deleteItemAsync).toHaveBeenCalledTimes(1);
    });
  });

  it("never wipes when the install isn't fresh", async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock("expo-secure-store", () => ({
        getItemAsync: jest.fn().mockResolvedValue("existing-session"),
        setItemAsync: jest.fn(),
        deleteItemAsync: jest.fn(),
      }));
      jest.doMock("@/lib/clearStaleKeychain", () => ({
        consumeFreshInstall: jest.fn().mockResolvedValue(false),
      }));

      const SecureStoreLocal = require("expo-secure-store");
      const { ExpoSecureStoreAdapter: Adapter } = require("../supabase");

      const result = await Adapter.getItem("sb-myproj-auth-token");
      expect(result).toBe("existing-session");
      expect(SecureStoreLocal.deleteItemAsync).not.toHaveBeenCalled();
    });
  });
});
