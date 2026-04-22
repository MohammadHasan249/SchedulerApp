"use client";

import { useState, use } from "react";
import { PinPad } from "@/components/kiosk/PinPad";
import { ClockConfirmation } from "@/components/kiosk/ClockConfirmation";
import { format } from "date-fns";

type ClockResult = {
  employeeName: string;
  clockType: "clock_in" | "clock_out";
  timestamp: string;
};

export default function KioskPage({ params }: { params: Promise<{ branchSlug: string }> }) {
  const { branchSlug } = use(params);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClockResult | null>(null);
  const [error, setError] = useState("");

  async function handlePin(pin: string) {
    setLoading(true);
    setResult(null);
    setError("");

    const res = await fetch("/api/clock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, branchSlug }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
    } else {
      setResult(data);
      // Auto-reset after 5 seconds
      setTimeout(() => {
        setResult(null);
        setError("");
      }, 5000);
    }

    setLoading(false);
  }

  function handleReset() {
    setResult(null);
    setError("");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Clock In / Out</h1>
        <p className="text-muted-foreground mt-1">{format(new Date(), "EEEE, MMMM d · HH:mm")}</p>
      </div>

      {result || error ? (
        <ClockConfirmation result={result} error={error} onReset={handleReset} />
      ) : (
        <PinPad onSubmit={handlePin} loading={loading} />
      )}
    </div>
  );
}
