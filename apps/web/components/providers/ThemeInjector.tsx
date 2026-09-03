"use client";

import { useEffect } from "react";
import { useOrg } from "./OrgContext";

type Props = {
  /**
   * When set (locked-brand domains like seaudecrabe.workplix.app), this
   * fixed color is used instead of the org's stored theme — keeps the web
   * dashboard from diverging from the mobile app's locked brand color.
   */
  lockedPrimary?: string | null;
  /**
   * When set, the sidebar background uses this instead of `primary` —
   * mobile's locked brands use a distinct chrome color (dark crimson) from
   * their accent color (brass), rather than one color driving both.
   */
  lockedSidebarBg?: string | null;
};

export function ThemeInjector({ lockedPrimary, lockedSidebarBg }: Props) {
  const { organization } = useOrg();
  const primary = lockedPrimary ?? organization?.theme?.primary;
  const sidebarBg = lockedSidebarBg ?? primary;

  useEffect(() => {
    if (!primary) return;
    const root = document.documentElement;
    // Primary brand color — drives buttons, links, focus rings, active states
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--ring", primary);
    root.style.setProperty("--sidebar-primary", primary);
    root.style.setProperty("--sidebar-ring", primary);
    root.style.setProperty("--chart-1", primary);
  }, [primary]);

  useEffect(() => {
    if (!sidebarBg) return;
    const root = document.documentElement;
    // Sidebar — solid brand color with white text
    root.style.setProperty("--sidebar", sidebarBg);
    root.style.setProperty("--sidebar-foreground", "#ffffff");
    root.style.setProperty("--sidebar-accent-foreground", "#ffffff");
    root.style.setProperty("--sidebar-accent", `color-mix(in srgb, white 20%, ${sidebarBg})`);
    root.style.setProperty("--sidebar-border", `color-mix(in srgb, black 15%, ${sidebarBg})`);
  }, [sidebarBg]);

  return null;
}
