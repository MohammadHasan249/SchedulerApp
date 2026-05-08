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
    // Sidebar — solid brand color with white text
    root.style.setProperty("--sidebar", theme.primary);
    root.style.setProperty("--sidebar-foreground", "#ffffff");
    root.style.setProperty("--sidebar-accent-foreground", "#ffffff");
    root.style.setProperty("--sidebar-accent", `color-mix(in srgb, white 20%, ${theme.primary})`);
    root.style.setProperty("--sidebar-border", `color-mix(in srgb, black 15%, ${theme.primary})`);
  }, [theme]);

  return null;
}
