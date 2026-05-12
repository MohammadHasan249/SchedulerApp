"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PinPad } from "./PinPad";
import { ClockConfirmation } from "./ClockConfirmation";
import { ExitPasscodeModal } from "./ExitPasscodeModal";
import { AdminPinSetup } from "./AdminPinSetup";

type ClockResult = {
  employeeName: string;
  clockType: "clock_in" | "clock_out";
  timestamp: string;
};

type Props = {
  branchSlug: string;
  adminEmployeeId?: string;
  needsPinSetup?: boolean;
};

export function KioskContent({ branchSlug, adminEmployeeId, needsPinSetup = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClockResult | null>(null);
  const [error, setError] = useState("");
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(needsPinSetup);

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

  function handleExitConfirmed() {
    setExitModalOpen(false);
    router.push("/dashboard");
  }

  return (
    <>
      {adminEmployeeId && (
        <AdminPinSetup
          open={showPinSetup}
          employeeId={adminEmployeeId}
          onSuccess={() => setShowPinSetup(false)}
        />
      )}

      <ExitPasscodeModal
        open={exitModalOpen}
        onClose={() => setExitModalOpen(false)}
        onExitConfirmed={handleExitConfirmed}
      />

      <div className="flex flex-col items-center gap-6">
        {result || error ? (
          <ClockConfirmation result={result} error={error} onReset={handleReset} />
        ) : (
          <PinPad onSubmit={handlePin} loading={loading} />
        )}

        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setExitModalOpen(true)}
        >
          <LogOut className="h-4 w-4" />
          Exit
        </Button>
      </div>
    </>
  );
}
