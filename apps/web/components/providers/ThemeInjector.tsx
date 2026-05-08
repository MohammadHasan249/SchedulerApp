"use client";

import { useEffect } from "react";
import { useOrg } from "./OrgContext";

export function ThemeInjector() {
  const { organization } = useOrg();
  const theme = organization?.theme;

  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    // Primary brand color — drives buttons, links, focus rings, active states
    root.style.setProperty("--primary", theme.primary);
    root.style.setProperty("--ring", theme.primary);
    root.style.setProperty("--sidebar-primary", theme.primary);
    root.style.setProperty("--sidebar-ring", theme.primary);
    root.style.setProperty("--chart-1", theme.primary);
    // Sidebar — dark tints derived from the primary brand color
    root.style.setProperty("--sidebar", `color-mix(in srgb, ${theme.primary} 18%, #000000)`);
    root.style.setProperty("--sidebar-accent", `color-mix(in srgb, ${theme.primary} 28%, #000000)`);
    root.style.setProperty("--sidebar-border", `color-mix(in srgb, ${theme.primary} 25%, #000000)`);
  }, [theme]);

  return null;
}
