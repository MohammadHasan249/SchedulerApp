"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  onSubmit: (pin: string) => void;
  loading: boolean;
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export function PinPad({ onSubmit, loading }: Props) {
  const [pin, setPin] = useState("");

  function handleKey(key: string) {
    if (key === "⌫") {
      setPin((prev) => prev.slice(0, -1));
    } else if (pin.length < 6) {
      const next = pin + key;
      setPin(next);
      if (next.length >= 4) {
        // Auto-submit after 6 digits; for 4-digit PINs, wait for submit
      }
    }
  }

  function handleSubmit() {
    if (pin.length >= 4) {
      onSubmit(pin);
      setPin("");
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* PIN display */}
      <div className="flex gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xl font-bold transition-colors ${
              i < pin.length ? "bg-primary border-primary text-primary-foreground" : "border-muted"
            }`}
          >
            {i < pin.length ? "•" : ""}
          </div>
        ))}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-56">
        {KEYS.map((key, i) => (
          <Button
            key={i}
            variant={key === "" ? "ghost" : "outline"}
            size="lg"
            className="h-14 text-xl font-semibold"
            disabled={key === "" || loading}
            onClick={() => key && handleKey(key)}
          >
            {key}
          </Button>
        ))}
      </div>

      <Button
        size="lg"
        className="w-56 h-14 text-lg"
        disabled={pin.length < 4 || loading}
        onClick={handleSubmit}
      >
        {loading ? "Verifying…" : "Clock In / Out"}
      </Button>
    </div>
  );
}
