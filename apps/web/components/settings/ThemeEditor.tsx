"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { THEME_PRESETS } from "@scheduler/types";
import type { OrganizationTheme } from "@scheduler/database/schema";

const FIXED_THEME = {
  secondary: "#64748b",
  accent: "#06b6d4",
  background: "#ffffff",
  foreground: "#000000",
} as const;

type Props = {
  initialTheme: OrganizationTheme;
  onSave: (theme: OrganizationTheme) => Promise<void>;
};

export function ThemeEditor({ initialTheme, onSave }: Props) {
  const initial = THEME_PRESETS.find((p) => p.primary === initialTheme.primary) ?? null;
  const [selected, setSelected] = useState(initial?.key ?? null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    const preset = THEME_PRESETS.find((p) => p.key === selected);
    if (!preset) return;
    setSaving(true);
    setSaved(false);
    try {
      await onSave({ primary: preset.primary, ...FIXED_THEME });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save theme:", error);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {THEME_PRESETS.map((preset) => {
          const isSelected = selected === preset.key;
          return (
            <button
              key={preset.key}
              onClick={() => setSelected(preset.key)}
              className="flex flex-col items-center gap-2 group focus:outline-none"
            >
              <div
                className="relative w-12 h-12 rounded-full transition-transform group-hover:scale-105"
                style={{
                  backgroundColor: preset.primary,
                  boxShadow: isSelected
                    ? `0 0 0 3px white, 0 0 0 5px ${preset.primary}`
                    : undefined,
                }}
              >
                {isSelected && (
                  <Check
                    className="absolute inset-0 m-auto h-5 w-5 text-white drop-shadow"
                    strokeWidth={3}
                  />
                )}
              </div>
              <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                {preset.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !selected}>
          {saving ? "Saving…" : "Save Theme"}
        </Button>
        {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
      </div>
    </div>
  );
}
