"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onClose: () => void;
  onExitConfirmed: () => void;
};

export function ExitPasscodeModal({ open, onClose, onExitConfirmed }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/exit-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (data.valid) {
        onExitConfirmed();
        setPin("");
        setError("");
      } else {
        setError("Incorrect passcode");
        setPin("");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      onClose();
      setPin("");
      setError("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            <DialogTitle>Exit Kiosk</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter the admin passcode to leave the clock-in screen.
          </p>

          <Input
            type="password"
            placeholder="Enter passcode"
            value={pin}
            disabled={loading}
            onChange={(e) => {
              setPin(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSubmit();
              }
            }}
            autoFocus
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading} className="flex-1">
              {loading ? "Verifying…" : "Exit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
