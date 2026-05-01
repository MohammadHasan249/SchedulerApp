"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OrganizationTheme } from "@/db/schema";

type Props = {
  initialTheme: OrganizationTheme;
  onSave: (theme: OrganizationTheme) => Promise<void>;
};

export function ThemeEditor({ initialTheme, onSave }: Props) {
  const [theme, setTheme] = useState(initialTheme);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);

    try {
      await onSave(theme);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save theme:", error);
    }

    setSaving(false);
  }

  function handleColorChange(key: keyof OrganizationTheme, value: string) {
    setTheme((prev) => ({ ...prev, [key]: value }));
  }

  const colors: { key: keyof OrganizationTheme; label: string; description: string }[] = [
    { key: "primary", label: "Primary", description: "Main brand color" },
    { key: "secondary", label: "Secondary", description: "Secondary accent color" },
    { key: "accent", label: "Accent", description: "Accent color for highlights" },
    { key: "background", label: "Background", description: "Primary background color" },
    { key: "foreground", label: "Foreground", description: "Text and foreground color" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6">
        {colors.map(({ key, label, description }) => (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label>{label}</Label>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              <div
                className="w-16 h-16 rounded-lg border-2 border-muted"
                style={{ backgroundColor: theme[key] }}
              />
            </div>
            <Input
              type="color"
              value={theme[key]}
              onChange={(e) => handleColorChange(key, e.target.value)}
              className="h-12"
            />
            <Input
              type="text"
              value={theme[key]}
              onChange={(e) => handleColorChange(key, e.target.value)}
              placeholder="#000000"
              className="font-mono text-sm"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Theme"}
        </Button>
        {saved && <span className="text-sm text-green-600">Saved!</span>}
      </div>
    </div>
  );
}
