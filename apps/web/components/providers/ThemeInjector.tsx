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
};

export function ThemeInjector({ lockedPrimary }: Props) {
  const { organization } = useOrg();
  const primary = lockedPrimary ?? organization?.theme?.primary;

  useEffect(() => {
    if (!primary) return;
    const root = document.documentElement;
    // Primary brand color — drives buttons, links, focus rings, active states
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--ring", primary);
    root.style.setProperty("--sidebar-primary", primary);
    root.style.setProperty("--sidebar-ring", primary);
    root.style.setProperty("--chart-1", primary);
    // Sidebar — solid brand color with white text
    root.style.setProperty("--sidebar", primary);
    root.style.setProperty("--sidebar-foreground", "#ffffff");
    root.style.setProperty("--sidebar-accent-foreground", "#ffffff");
    root.style.setProperty("--sidebar-accent", `color-mix(in srgb, white 20%, ${primary})`);
    root.style.setProperty("--sidebar-border", `color-mix(in srgb, black 15%, ${primary})`);
  }, [primary]);

  return null;
}
