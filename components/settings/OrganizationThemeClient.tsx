"use client";

import { ThemeEditor } from "./ThemeEditor";
import type { OrganizationTheme } from "@/db/schema";

type Props = {
  initialTheme: OrganizationTheme;
};

export function OrganizationThemeClient({ initialTheme }: Props) {
  async function handleSave(theme: OrganizationTheme) {
    const res = await fetch("/api/org/theme", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(theme),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Failed to save theme");
    }
  }

  return <ThemeEditor initialTheme={initialTheme} onSave={handleSave} />;
}
