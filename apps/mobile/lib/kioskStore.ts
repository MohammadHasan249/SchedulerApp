import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const BRANCH_SLUG_KEY = "kiosk_branch_slug";

interface KioskState {
  isLocked: boolean;
  branchSlug: string | null;
  setLocked: (locked: boolean) => void;
  setBranchSlug: (slug: string) => Promise<void>;
  loadBranchSlug: () => Promise<void>;
}

export const useKioskStore = create<KioskState>((set) => ({
  isLocked: false,
  branchSlug: null,
  setLocked: (locked) => set({ isLocked: locked }),
  setBranchSlug: async (slug) => {
    await SecureStore.setItemAsync(BRANCH_SLUG_KEY, slug);
    set({ branchSlug: slug });
  },
  loadBranchSlug: async () => {
    const slug = await SecureStore.getItemAsync(BRANCH_SLUG_KEY);
    set({ branchSlug: slug ?? null });
  },
}));
