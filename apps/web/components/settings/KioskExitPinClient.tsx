"use client";

import { useState } from "react";

type Props = {
  initialIsSet: boolean;
};

export function KioskExitPinClient({ initialIsSet }: Props) {
  const [isSet, setIsSet] = useState(initialIsSet);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    setError(null);
    setSuccess(false);

    if (!/^\d{4,6}$/.test(pin)) {
      setError("PIN must be 4–6 digits.");
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs do not match.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings/exit-pin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save PIN");
      }
      setIsSet(true);
      setPin("");
      setConfirmPin("");
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save PIN");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 max-w-sm">
      <p className="text-sm text-muted-foreground">
        {isSet
          ? "An exit PIN is set. Staff on a mobile kiosk device enter it to leave kiosk mode."
          : "No exit PIN is set yet — kiosk mode on mobile devices cannot be exited until you set one."}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder="New PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="border rounded-md px-3 py-2 text-sm"
        />
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder="Confirm PIN"
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
          className="border rounded-md px-3 py-2 text-sm"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {saving ? "Saving…" : isSet ? "Update PIN" : "Set PIN"}
        </button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">Exit PIN saved.</p>}
    </div>
  );
}
