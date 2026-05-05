"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle } from "lucide-react";

type Props = {
  open: boolean;
  employeeId: string;
  onSuccess: () => void;
};

export function AdminPinSetup({ open, employeeId, onSuccess }: Props) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    if (pin.length < 4 || pin.length > 6) {
      setError("PIN must be 4-6 digits");
      return;
    }

    if (pin !== confirmPin) {
      setError("PINs do not match");
      return;
    }

    setLoading(true);
    setError("");

    const res = await fetch(`/api/employees/${employeeId}/pin`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to set PIN");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      onSuccess();
    }, 2000);
  }

  if (success) {
    return (
      <Dialog open={open}>
        <DialogContent className="sm:max-w-sm">
          <div className="flex flex-col items-center gap-4 text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <div>
              <h2 className="text-lg font-semibold">PIN Set Successfully</h2>
              <p className="text-sm text-muted-foreground mt-1">
                You can now use this PIN to clock in and out.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Set Up Your PIN</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Set a 4-6 digit PIN to use the clock-in screen.
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium">PIN</label>
            <Input
              type="password"
              placeholder="Enter 4-6 digits"
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, "");
                if (val.length <= 6) setPin(val);
              }}
              maxLength={6}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Confirm PIN</label>
            <Input
              type="password"
              placeholder="Confirm PIN"
              value={confirmPin}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, "");
                if (val.length <= 6) setConfirmPin(val);
              }}
              maxLength={6}
            />
          </div>

          {error && (
            <div className="flex gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={loading || pin.length < 4 || pin !== confirmPin}
            className="w-full"
          >
            {loading ? "Setting PIN…" : "Set PIN"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
