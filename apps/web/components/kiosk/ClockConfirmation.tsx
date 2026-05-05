"use client";

import { format } from "date-fns";
import { CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  result: {
    employeeName: string;
    clockType: "clock_in" | "clock_out";
    timestamp: string;
  } | null;
  error: string;
  onReset: () => void;
};

export function ClockConfirmation({ result, error, onReset }: Props) {
  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <XCircle className="h-16 w-16 text-destructive" />
        <p className="text-xl font-semibold text-destructive">{error}</p>
        <Button onClick={onReset} size="lg">Try Again</Button>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <CheckCircle className="h-16 w-16 text-green-500" />
      <div>
        <p className="text-2xl font-bold">{result.employeeName}</p>
        <p className="text-lg text-muted-foreground capitalize">
          {result.clockType === "clock_in" ? "Clocked In" : "Clocked Out"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {format(new Date(result.timestamp), "HH:mm:ss")}
        </p>
      </div>
      <Button onClick={onReset} size="lg" variant="outline">
        Done
      </Button>
    </div>
  );
}
