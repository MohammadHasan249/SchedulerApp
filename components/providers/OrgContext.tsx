"use client";

import { createContext, useContext } from "react";
import { type AppUser } from "@/lib/auth/getUser";

type OrgContextValue = {
  user: AppUser;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgContextProvider({
  user,
  children,
}: {
  user: AppUser;
  children: React.ReactNode;
}) {
  return <OrgContext.Provider value={{ user }}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used inside OrgContextProvider");
  return ctx;
}
