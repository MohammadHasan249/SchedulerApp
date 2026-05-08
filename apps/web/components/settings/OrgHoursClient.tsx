"use client";

import { HoursEditor } from "./HoursEditor";
import type { HoursSchedule } from "@scheduler/database/schema";

type Props = {
  initialHours: HoursSchedule;
};

export function OrgHoursClient({ initialHours }: Props) {
  async function handleSave(schedule: HoursSchedule) {
    const res = await fetch("/api/settings/hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schedule),
    });
    if (!res.ok) throw new Error("Failed to save");
  }

  async function handleApply() {
    const res = await fetch("/api/settings/hours/apply", { method: "POST" });
    if (!res.ok) throw new Error("Failed to apply");
    return res.json() as Promise<{ applied: number }>;
  }

  return <HoursEditor initial={initialHours} onSave={handleSave} onApply={handleApply} />;
}
