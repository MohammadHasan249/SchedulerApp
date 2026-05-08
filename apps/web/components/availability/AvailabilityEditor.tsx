"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TimePicker } from "@/components/ui/time-picker";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DaySlot = {
  enabled: boolean;
  startTime: string;
  endTime: string;
};

type AvailabilityRow = { dayOfWeek: number; startTime: string; endTime: string };

function toSlots(rows: AvailabilityRow[]): DaySlot[] {
  return DAYS.map((_, i) => {
    const row = rows.find((r) => r.dayOfWeek === i);
    return row
      ? { enabled: true, startTime: row.startTime.slice(0, 5), endTime: row.endTime.slice(0, 5) }
      : { enabled: false, startTime: "09:00", endTime: "23:00" };
  });
}

type Props = {
  employeeId: string;
  initial: AvailabilityRow[];
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

    const payload: Record<number, { startTime: string; endTime: string }> = {};
    slots.forEach((s, i) => {
      if (s.enabled) {
        payload[i] = { startTime: s.startTime, endTime: s.endTime };
      }
    });

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
    <div className="space-y-2">
      {DAYS.map((day, i) => (
        <div
          key={i}
          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-xl border sm:border-0 sm:rounded-none p-3 sm:p-0 bg-card sm:bg-transparent"
        >
          <div className="flex items-center gap-3">
            <Switch
              checked={slots[i].enabled}
              onCheckedChange={(v) => !readOnly && setSlot(i, { enabled: v })}
              disabled={readOnly}
              id={`avail-${i}`}
            />
            <Label htmlFor={`avail-${i}`} className="text-sm font-medium min-w-0">
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{DAYS_SHORT[i]}</span>
            </Label>
          </div>

          {slots[i].enabled ? (
            <div className="flex items-center gap-2 pl-9 sm:pl-0">
              <TimePicker
                value={slots[i].startTime}
                onChange={(v) => !readOnly && setSlot(i, { startTime: v })}
                disabled={readOnly}
              />
              <span className="text-muted-foreground text-sm">to</span>
              <TimePicker
                value={slots[i].endTime}
                onChange={(v) => !readOnly && setSlot(i, { endTime: v })}
                disabled={readOnly}
              />
            </div>
          ) : (
            <span className="text-sm text-muted-foreground pl-9 sm:pl-0">Unavailable</span>
          )}
        </div>
      ))}

      {!readOnly && (
        <div className="flex items-center gap-3 pt-3">
          <Button size="sm" onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? "Saving…" : "Save Availability"}
          </Button>
          {saved && <span className="text-sm text-green-600">Saved!</span>}
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>
      )}
    </div>
  );
}
