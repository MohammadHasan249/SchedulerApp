import { create } from "zustand";
import type { OrganizationTheme } from "@scheduler/types";

interface ThemeState {
  theme: OrganizationTheme | null;
  setTheme: (theme: OrganizationTheme | null) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: null,
  setTheme: (theme) => set({ theme }),
}));
