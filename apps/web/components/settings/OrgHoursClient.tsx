"use client";

import { useRouter } from "next/navigation";
import { HoursEditor } from "./HoursEditor";
import type { HoursSchedule } from "@scheduler/types";

type Props = {
  initialHours: HoursSchedule;
};

export function OrgHoursClient({ initialHours }: Props) {
  const router = useRouter();

  async function handleSave(schedule: HoursSchedule) {
    const res = await fetch("/api/settings/hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schedule),
    });
    if (!res.ok) throw new Error("Failed to save");

    router.refresh();
  }

  return <HoursEditor initial={initialHours} onSave={handleSave} />;
}
