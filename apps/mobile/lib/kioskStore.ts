import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const BRANCH_SLUG_KEY = "kiosk_branch_slug";
const LOCKED_KEY = "kiosk_locked";

interface KioskState {
  isLocked: boolean;
  branchSlug: string | null;
  setLocked: (locked: boolean) => void;
  setBranchSlug: (slug: string) => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useKioskStore = create<KioskState>((set) => ({
  isLocked: false,
  branchSlug: null,
  // Persisted so force-quitting the app doesn't escape kiosk mode without
  // the admin exit PIN.
  setLocked: (locked) => {
    set({ isLocked: locked });
    SecureStore.setItemAsync(LOCKED_KEY, locked ? "1" : "0").catch(() => {});
  },
  setBranchSlug: async (slug) => {
    await SecureStore.setItemAsync(BRANCH_SLUG_KEY, slug);
    set({ branchSlug: slug });
  },
  hydrate: async () => {
    const [slug, locked] = await Promise.all([
      SecureStore.getItemAsync(BRANCH_SLUG_KEY),
      SecureStore.getItemAsync(LOCKED_KEY),
    ]);
    set({ branchSlug: slug ?? null, isLocked: locked === "1" });
  },
}));
