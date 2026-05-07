"use client";

import { HoursEditor } from "./HoursEditor";
import type { OrganizationHours } from "@scheduler/database/schema";

type Props = {
  initialHours: OrganizationHours[];
};

export function OrgHoursClient({ initialHours }: Props) {
  async function handleSave(rows: { isClosed: boolean; startTime: string; endTime: string }[]) {
    const payload = rows.map((r, i) => ({
      dayOfWeek: i,
      isClosed: r.isClosed,
      startTime: r.isClosed ? null : r.startTime,
      endTime: r.isClosed ? null : r.endTime,
    }));
    const res = await fetch("/api/settings/hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
