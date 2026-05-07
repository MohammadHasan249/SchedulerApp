"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Shift, Employee } from "@scheduler/database/schema";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  branchId: string;
  defaultDate?: Date;
  employees: Employee[];
  availability?: { dayOfWeek: number; startTime: string; endTime: string }[];
  shift?: Shift;
  assignments?: { id: string; employeeId: string; jobRoleId: string | null }[];
  onSaved: () => void;
};

export function ShiftCreateDialog({
  open,
  onOpenChange,
  branchId,
  defaultDate,
  employees,
  availability = [],
  shift,
  assignments = [],
  onSaved,
}: Props) {
  const isEdit = !!shift;
  const dateStr = defaultDate ? format(defaultDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");

  const [date, setDate] = useState(
    shift ? format(new Date(shift.startTime), "yyyy-MM-dd") : dateStr
  );
  const [startTime, setStartTime] = useState(
    shift ? format(new Date(shift.startTime), "HH:mm") : "09:00"
  );
  const [endTime, setEndTime] = useState(
    shift ? format(new Date(shift.endTime), "HH:mm") : "17:00"
  );
  const [assignedIds, setAssignedIds] = useState<string[]>(assignments.map((a) => a.employeeId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [availabilityWarning, setAvailabilityWarning] = useState<string[]>([]);
  const [overrideAvailability, setOverrideAvailability] = useState(false);

  useEffect(() => {
    if (open) {
      if (shift) {
        setDate(format(new Date(shift.startTime), "yyyy-MM-dd"));
        setStartTime(format(new Date(shift.startTime), "HH:mm"));
        setEndTime(format(new Date(shift.endTime), "HH:mm"));
        setAssignedIds(assignments.map((a) => a.employeeId));
      } else {
        setDate(dateStr);
        setStartTime("09:00");
        setEndTime("17:00");
        setAssignedIds([]);
      }
      setError("");
      setAvailabilityWarning([]);
      setOverrideAvailability(false);
    }
  }, [open, shift, assignments, dateStr]);

  function toggleEmployee(id: string) {
    setAssignedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function getEmployeeAvailability(empId: string): string {
    const [year, month, day] = date.split("-").map(Number);
    const shiftDate = new Date(year, month - 1, day);
    const dayOfWeek = shiftDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

    const employee = employees.find((e) => e.id === empId);
    if (!employee) return "Employee not found";

    const schedule = employee.availabilitySchedule as Record<number, { startTime: string; endTime: string }> | null;
    if (!schedule || !schedule[dayOfWeek]) return "No availability set";

    const slot = schedule[dayOfWeek];
    return `${slot.startTime}–${slot.endTime}`;
  }

  function checkAvailabilityConflicts(): string[] {
    const [year, month, day] = date.split("-").map(Number);
    const shiftDate = new Date(year, month - 1, day);
    const dayOfWeek = shiftDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

    const conflicts: string[] = [];

    for (const empId of assignedIds) {
      const employee = employees.find((e) => e.id === empId);
      if (!employee) continue;

      const schedule = employee.availabilitySchedule as Record<number, { startTime: string; endTime: string }> | null;
      const empAvailability = schedule?.[dayOfWeek];

      if (!empAvailability) {
        conflicts.push(`${employee.name} has no availability set for this day`);
      } else {
        const shiftStart = startTime;
        const shiftEnd = endTime;
        const availStart = empAvailability.startTime.slice(0, 5); // HH:MM format
        const availEnd = empAvailability.endTime.slice(0, 5);
        const available = availStart <= shiftStart && availEnd >= shiftEnd;

        if (!available) {
          conflicts.push(`${employee.name} is not available ${shiftStart}–${shiftEnd}`);
        }
      }
    }

    return conflicts;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const startISO = new Date(`${date}T${startTime}:00`).toISOString();
    const endISO = new Date(`${date}T${endTime}:00`).toISOString();

    if (new Date(startISO) >= new Date(endISO)) {
      setError("End time must be after start time");
      setLoading(false);
      return;
    }

    const conflicts = checkAvailabilityConflicts();
    if (conflicts.length > 0 && !overrideAvailability) {
      // Show as a warning and let the manager confirm — don't hard-block
      setAvailabilityWarning(conflicts);
      setLoading(false);
      return;
    }

    let shiftId = shift?.id;

    if (!isEdit) {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, startTime: startISO, endTime: endISO }),
      });
      if (!res.ok) {
        const d = await res.json();
        const msg = typeof d.error === "string" ? d.error : "Failed to create shift";
        setError(msg);
        setLoading(false);
        return;
      }
      const newShift = await res.json();
      shiftId = newShift.id;
    } else {
      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startTime: startISO, endTime: endISO }),
      });
      if (!res.ok) {
        const d = await res.json();
        let msg = "Failed to update shift";
        if (typeof d.error === "string") {
          msg = d.error;
        } else if (d.error?.fieldErrors) {
          const firstError = Object.values(d.error.fieldErrors)[0];
          msg = Array.isArray(firstError) ? firstError[0] : "Validation error";
        }
        setError(msg);
        setLoading(false);
        return;
      }
    }

    // Sync assignments: add newly checked, remove unchecked
    for (const empId of assignedIds) {
      if (!assignments.find((a) => a.employeeId === empId)) {
        await fetch(`/api/shifts/${shiftId}/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId: empId }),
        });
      }
    }
    for (const existing of assignments) {
      if (!assignedIds.includes(existing.employeeId)) {
        await fetch(`/api/shifts/${shiftId}/assign`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignmentId: existing.id }),
        });
      }
    }

    setLoading(false);
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Shift" : "Create Shift"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Start</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>End</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Assign Employees</Label>
            <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1">
              {employees
                .filter((e) => e.isActive)
                .map((emp) => (
                  <label key={emp.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assignedIds.includes(emp.id)}
                      onChange={() => toggleEmployee(emp.id)}
                    />
                    <div className="flex-1">
                      <div>{emp.name}</div>
                      <div className="text-xs text-muted-foreground">{getEmployeeAvailability(emp.id)}</div>
                    </div>
                  </label>
                ))}
              {employees.filter((e) => e.isActive).length === 0 && (
                <p className="text-xs text-muted-foreground">No active employees.</p>
              )}
            </div>
          </div>
          {availabilityWarning.length > 0 && !overrideAvailability && (
            <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 space-y-2">
              <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                Availability conflicts — schedule anyway?
              </p>
              <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-0.5">
                {availabilityWarning.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-yellow-500/50 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-500/10"
                onClick={() => setOverrideAvailability(true)}
              >
                Schedule anyway
              </Button>
            </div>
          )}
          {error && (
            <div className="text-sm text-destructive whitespace-pre-wrap">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : isEdit ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
