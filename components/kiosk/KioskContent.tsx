"use client";

import { useState } from "react";
import { PinPad } from "./PinPad";
import { ClockConfirmation } from "./ClockConfirmation";

type ClockResult = {
  employeeName: string;
  clockType: "clock_in" | "clock_out";
  timestamp: string;
};

type Props = {
  branchSlug: string;
};

export function KioskContent({ branchSlug }: Props) {
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
    <>
      {result || error ? (
        <ClockConfirmation result={result} error={error} onReset={handleReset} />
      ) : (
        <PinPad onSubmit={handlePin} loading={loading} />
      )}
    </>
  );
}
