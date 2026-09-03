"use client";

import { format, addWeeks, subWeeks } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getZonedWeekStart } from "@/lib/utils/timezone";

type Props = {
  weekStart: Date;
  onWeekChange: (d: Date) => void;
  timezone: string;
};

export function WeekNavigator({ weekStart, onWeekChange, timezone }: Props) {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="icon" onClick={() => onWeekChange(subWeeks(weekStart, 1))}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium min-w-48 text-center">
        {format(weekStart, "MMM d")} – {format(end, "MMM d, yyyy")}
      </span>
      <Button variant="outline" size="icon" onClick={() => onWeekChange(addWeeks(weekStart, 1))}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onWeekChange(getZonedWeekStart(timezone, new Date(), 1))}
      >
        Today
      </Button>
    </div>
  );
}
