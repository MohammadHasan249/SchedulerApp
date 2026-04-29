"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Availability } from "@/db/schema";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type DaySlot = {
  enabled: boolean;
  startTime: string;
  endTime: string;
};

function toSlots(rows: Availability[]): DaySlot[] {
  return DAYS.map((_, i) => {
    const row = rows.find((r) => r.dayOfWeek === i);
    return row
      ? { enabled: true, startTime: row.startTime.slice(0, 5), endTime: row.endTime.slice(0, 5) }
      : { enabled: true, startTime: "09:00", endTime: "17:00" };
  });
}

type Props = {
  employeeId: string;
  initial: Availability[];
  readOnly?: boolean;
};

export function AvailabilityEditor({ employeeId, initial, readOnly = false }: Props) {
  const [slots, setSlots] = useState<DaySlot[]>(toSlots(initial));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function setSlot(i: number, patch: Partial<DaySlot>) {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);

    const payload = slots
      .map((s, i) => ({ ...s, dayOfWeek: i }))
      .filter((s) => s.enabled)
      .map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime }));

    const res = await fetch(`/api/availability/${employeeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      setError("Failed to save availability");
    } else {
      setSaved(true);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      {DAYS.map((day, i) => (
        <div key={i} className="flex items-center gap-3">
          <Switch
            checked={slots[i].enabled}
            onCheckedChange={(v) => !readOnly && setSlot(i, { enabled: v })}
            disabled={readOnly}
            id={`avail-${i}`}
          />
          <Label htmlFor={`avail-${i}`} className="w-24 text-sm">
            {day}
          </Label>
          {slots[i].enabled ? (
            <>
              <Input
                type="time"
                value={slots[i].startTime}
                onChange={(e) => !readOnly && setSlot(i, { startTime: e.target.value })}
                disabled={readOnly}
                className="w-28"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <Input
                type="time"
                value={slots[i].endTime}
                onChange={(e) => !readOnly && setSlot(i, { endTime: e.target.value })}
                disabled={readOnly}
                className="w-28"
              />
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Unavailable</span>
          )}
        </div>
      ))}
      {!readOnly && (
        <div className="flex items-center gap-3 pt-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Availability"}
          </Button>
          {saved && <span className="text-sm text-green-600">Saved!</span>}
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>
      )}
    </div>
  );
}
