"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Shift, Employee } from "@scheduler/types";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shifts: Shift[];
  employees: Employee[];
  currentEmployeeId?: string;
};

export function ShiftSwapForm({ open, onOpenChange, shifts, employees, currentEmployeeId }: Props) {
  const router = useRouter();
  const [shiftId, setShiftId] = useState<string | undefined>(undefined);
  const [coverId, setCoverId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setShiftId(undefined);
      setCoverId(undefined);
      setError("");
    }
  }, [open]);

  const selectedShift = shifts.find((s) => s.id === shiftId);

  // Mirrors the server-side eligibility check in POST /api/shift-swaps:
  // same branch as the shift, not the requester themself.
  const eligibleCovers = selectedShift
    ? employees.filter(
        (e) => e.id !== currentEmployeeId && e.branchId === selectedShift.branchId && e.isActive
      )
    : [];

  useEffect(() => {
    setCoverId(undefined);
  }, [shiftId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!shiftId || !coverId) {
      setError("Select a shift and a cover employee");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/shift-swaps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId, coverId }),
    });

    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    setLoading(false);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Request Shift Swap</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Shift</Label>
            {shifts.length === 0 ? (
              <p className="text-sm text-muted-foreground">You have no upcoming assigned shifts to swap.</p>
            ) : (
              <Select value={shiftId} onValueChange={(v) => setShiftId(v ?? undefined)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a shift" />
                </SelectTrigger>
                <SelectContent>
                  {shifts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {format(new Date(s.startTime), "EEE MMM d, h:mm a")} – {format(new Date(s.endTime), "h:mm a")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {shiftId && (
            <div className="space-y-1">
              <Label>Cover</Label>
              {eligibleCovers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No eligible employees at this branch to cover the shift.</p>
              ) : (
                <Select value={coverId} onValueChange={(v) => setCoverId(v ?? undefined)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Who should cover this shift?" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleCovers.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !shiftId || !coverId}>
              {loading ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
