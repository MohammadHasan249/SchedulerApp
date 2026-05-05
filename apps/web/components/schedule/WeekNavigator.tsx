"use client";

import { format, addWeeks, subWeeks, startOfWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  weekStart: Date;
  onWeekChange: (d: Date) => void;
};

export function WeekNavigator({ weekStart, onWeekChange }: Props) {
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
        onClick={() => onWeekChange(startOfWeek(new Date(), { weekStartsOn: 1 }))}
      >
        Today
      </Button>
    </div>
  );
}
