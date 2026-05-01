"use client";

import { createContext, useContext } from "react";
import { type AppUser } from "@/lib/auth/getUser";
import { type OrganizationTheme } from "@/db/schema";

type Organization = {
  name?: string;
  theme?: OrganizationTheme | null;
};

type OrgContextValue = {
  user: AppUser;
  organization?: Organization;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgContextProvider({
  user,
  organization,
  children,
}: {
  user: AppUser;
  organization?: Organization;
  children: React.ReactNode;
}) {
  return <OrgContext.Provider value={{ user, organization }}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used inside OrgContextProvider");
  return ctx;
}
