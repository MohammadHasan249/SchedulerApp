import { create } from "zustand";
import { getOrganizationInfo } from "@/lib/api";

interface OrgState {
  orgName: string | null;
  fetchOrgInfo: () => Promise<void>;
}

export const useOrgStore = create<OrgState>((set) => ({
  orgName: null,
  fetchOrgInfo: async () => {
    try {
      const info = await getOrganizationInfo();
      set({ orgName: info.name });
    } catch {
      // silent
    }
  },
}));
