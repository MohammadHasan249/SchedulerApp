import { create } from "zustand";
import { getEmployees } from "@/lib/api";
import type { Employee } from "@scheduler/types";

// The server never writes employee_id into Supabase user metadata, so the
// only reliable way to find "my" employee record is matching authUserId.
interface MyEmployeeState {
  employee: Employee | null;
  loaded: boolean;
  fetchMyEmployee: (authUserId: string) => Promise<Employee | null>;
  reset: () => void;
}

let inflight: Promise<Employee | null> | null = null;

export const useMyEmployeeStore = create<MyEmployeeState>((set, get) => ({
  employee: null,
  loaded: false,
  fetchMyEmployee: async (authUserId) => {
    const cached = get().employee;
    if (cached?.authUserId === authUserId) return cached;
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const all = await getEmployees();
        const mine = all.find((e) => e.authUserId === authUserId) ?? null;
        set({ employee: mine, loaded: true });
        return mine;
      } catch {
        set({ loaded: true });
        return null;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },
  reset: () => {
    inflight = null;
    set({ employee: null, loaded: false });
  },
}));
