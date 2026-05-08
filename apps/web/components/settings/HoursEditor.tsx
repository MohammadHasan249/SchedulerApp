"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TimePicker } from "@/components/ui/time-picker";
import type { HoursSchedule } from "@scheduler/database/schema";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DayRow = {
  isClosed: boolean;
  startTime: string;
  endTime: string;
};

function toRows(schedule: HoursSchedule): DayRow[] {
  return DAYS.map((_, i) => {
    const slot = schedule[i];
    return slot
      ? { isClosed: false, startTime: slot.startTime, endTime: slot.endTime }
      : { isClosed: true, startTime: "09:00", endTime: "17:00" };
  });
}

function toSchedule(rows: DayRow[]): HoursSchedule {
  const schedule: HoursSchedule = {};
  rows.forEach((r, i) => {
    if (!r.isClosed) schedule[i] = { startTime: r.startTime, endTime: r.endTime };
  });
  return schedule;
}

type Props = {
  initial: HoursSchedule;
  onSave: (schedule: HoursSchedule) => Promise<void>;
  onApply: () => Promise<{ applied: number }>;
};

export function HoursEditor({ initial, onSave, onApply }: Props) {
  const [rows, setRows] = useState<DayRow[]>(toRows(initial));
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [status, setStatus] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  function setRow(i: number, patch: Partial<DayRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function handleSave() {
    setSaving(true);
    setStatus(null);
    try {
      await onSave(toSchedule(rows));
      setStatus({ type: "ok", msg: "Saved!" });
    } catch {
      setStatus({ type: "err", msg: "Failed to save hours of operation" });
    }
    setSaving(false);
  }

  async function handleApply() {
    setApplying(true);
    setStatus(null);
    try {
      const { applied } = await onApply();
      setStatus({ type: "ok", msg: `Applied to ${applied} employees` });
    } catch {
      setStatus({ type: "err", msg: "Failed to apply defaults" });
    }
    setApplying(false);
  }

  return (
    <div className="space-y-4">
      {DAYS.map((day, i) => (
        <div
          key={i}
          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-xl border sm:border-0 sm:rounded-none p-3 sm:p-0 bg-card sm:bg-transparent"
        >
          <div className="flex items-center gap-3">
            <Switch
              checked={!rows[i].isClosed}
              onCheckedChange={(open) => setRow(i, { isClosed: !open })}
              id={`hours-${i}`}
            />
            <Label htmlFor={`hours-${i}`} className="text-sm font-medium min-w-0">
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{DAYS_SHORT[i]}</span>
            </Label>
          </div>
          {!rows[i].isClosed ? (
            <div className="flex items-center gap-2 pl-9 sm:pl-0">
              <TimePicker
                value={rows[i].startTime}
                onChange={(v) => setRow(i, { startTime: v })}
              />
              <span className="text-muted-foreground text-sm">to</span>
              <TimePicker
                value={rows[i].endTime}
                onChange={(v) => setRow(i, { endTime: v })}
              />
            </div>
          ) : (
            <span className="text-sm text-muted-foreground pl-9 sm:pl-0">Closed</span>
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3 pt-3">
        <Button size="sm" onClick={handleSave} disabled={saving || applying}>
          {saving ? "Saving…" : "Save Hours"}
        </Button>
        <Button size="sm" variant="outline" onClick={handleApply} disabled={saving || applying}>
          {applying ? "Applying…" : "Apply to All Employees"}
        </Button>
        {status && (
          <span className={`text-sm ${status.type === "ok" ? "text-green-600" : "text-destructive"}`}>
            {status.msg}
          </span>
        )}
      </div>
    </div>
  );
}
