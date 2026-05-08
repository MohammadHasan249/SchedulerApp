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
    // Background and foreground
    root.style.setProperty("--background", theme.background);
    root.style.setProperty("--foreground", theme.foreground);
    root.style.setProperty("--card-foreground", theme.foreground);
    root.style.setProperty("--popover-foreground", theme.foreground);
  }, [theme]);

  return null;
}
