"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  initialEnabled: boolean;
};

export function WebKioskToggleClient({ initialEnabled }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    const next = !enabled;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/web-kiosk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update setting");
      }
      setEnabled(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update setting");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 max-w-sm">
      <p className="text-sm text-muted-foreground">
        {enabled
          ? "Admins and branch managers can clock in/out from the web via the Clock In/Out nav item."
          : "The web clock in/out kiosk is off. Turn it on to let admins and branch managers use it."}
      </p>
      <button
        onClick={handleToggle}
        disabled={saving}
        role="switch"
        aria-checked={enabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 ${
          enabled ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
