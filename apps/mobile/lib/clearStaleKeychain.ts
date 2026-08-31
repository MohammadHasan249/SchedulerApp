import AsyncStorage from "@react-native-async-storage/async-storage";

// AsyncStorage is wiped on uninstall, but expo-secure-store (iOS Keychain /
// Android Keystore) is not — its entries survive an app reinstall. Use
// AsyncStorage as a "have we launched before" marker so a fresh install can
// discard anything left over from a previous install: the kiosk lock state,
// and — more importantly — the Supabase session (otherwise reinstalling the
// app can silently sign in as whoever last used the device).
const LAUNCHED_BEFORE_KEY = "has_launched_before";

// Memoized so every caller in this process — the Supabase storage adapter
// reading its auth-token key, and the root layout clearing kiosk state —
// resolves the same true/false answer regardless of call order, and the
// AsyncStorage marker is only ever read/written once per process.
let freshInstallCheck: Promise<boolean> | null = null;

// Resolves true exactly once per fresh install (the first call across the
// whole app lifetime after a reinstall); every other call, this launch or
// any future one, resolves false.
export function consumeFreshInstall(): Promise<boolean> {
  if (!freshInstallCheck) {
    freshInstallCheck = (async () => {
      const launchedBefore = await AsyncStorage.getItem(LAUNCHED_BEFORE_KEY);
      await AsyncStorage.setItem(LAUNCHED_BEFORE_KEY, "1");
      return !launchedBefore;
    })();
  }
  return freshInstallCheck;
}
