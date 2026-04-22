"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Shift, Employee, Department } from "@/db/schema";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  branchId: string;
  defaultDate?: Date;
  departments: Department[];
  employees: Employee[];
  shift?: Shift;
  assignments?: { id: string; employeeId: string; jobRoleId: string | null }[];
  onSaved: () => void;
};

export function ShiftCreateDialog({
  open, onOpenChange, branchId, defaultDate, departments, employees, shift, assignments = [], onSaved,
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
  const [deptId, setDeptId] = useState(shift?.departmentId ?? "");
  const [assignedIds, setAssignedIds] = useState<string[]>(assignments.map((a) => a.employeeId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleEmployee(id: string) {
    setAssignedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
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

    let shiftId = shift?.id;

    if (!isEdit) {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, departmentId: deptId || null, startTime: startISO, endTime: endISO }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to create shift");
        setLoading(false);
        return;
      }
      const newShift = await res.json();
      shiftId = newShift.id;
    } else {
      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentId: deptId || null, startTime: startISO, endTime: endISO }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to update shift");
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
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>End</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Department (optional)</Label>
            <Select value={deptId} onValueChange={(v) => setDeptId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Assign Employees</Label>
            <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1">
              {employees.filter((e) => e.isActive).map((emp) => (
                <label key={emp.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assignedIds.includes(emp.id)}
                    onChange={() => toggleEmployee(emp.id)}
                  />
                  {emp.name}
                </label>
              ))}
              {employees.filter((e) => e.isActive).length === 0 && (
                <p className="text-xs text-muted-foreground">No active employees.</p>
              )}
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving…" : isEdit ? "Save" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
