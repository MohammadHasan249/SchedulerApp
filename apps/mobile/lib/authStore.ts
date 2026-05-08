import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";

interface AuthState {
  session: Session | null;
  employeeName: string | null;
  setSession: (session: Session | null) => void;
  setEmployeeName: (name: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  employeeName: null,
  setSession: (session) => set({ session }),
  setEmployeeName: (name) => set({ employeeName: name }),
}));
