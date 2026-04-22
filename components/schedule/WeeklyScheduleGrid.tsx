"use client";

import { useState, useCallback } from "react";
import { format, addDays, startOfWeek } from "date-fns";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { ShiftCard } from "./ShiftCard";
import { ShiftCreateDialog } from "./ShiftCreateDialog";
import { WeekNavigator } from "./WeekNavigator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Shift, ShiftAssignment, Employee, Department, Branch } from "@/db/schema";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type ScheduleData = {
  shifts: Shift[];
  assignments: ShiftAssignment[];
  employees: Employee[];
  departments: Department[];
  branches: Branch[];
  canEdit: boolean;
  currentBranchId: string;
};

function DayCell({
  date, shifts, assignments, employees, canEdit, isPast, onEdit, onDelete, onAddShift,
}: {
  date: Date;
  shifts: Shift[];
  assignments: ShiftAssignment[];
  employees: Employee[];
  canEdit: boolean;
  isPast: boolean;
  onEdit: (shift: Shift) => void;
  onDelete: (id: string) => void;
  onAddShift: (date: Date) => void;
}) {
  const dateKey = format(date, "yyyy-MM-dd");
  const { setNodeRef, isOver } = useDroppable({ id: dateKey, data: { date } });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-28 p-1 space-y-1 border-r last:border-r-0 ${isOver ? "bg-accent/50" : ""}`}
    >
      {shifts.map((s) => (
        <ShiftCard
          key={s.id}
          shift={s}
          assignments={assignments.filter((a) => a.shiftId === s.id)}
          employees={employees}
          isPast={isPast || new Date(s.startTime) < new Date()}
          canEdit={canEdit}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
      {canEdit && !isPast && (
        <button
          className="w-full text-xs text-muted-foreground hover:text-foreground py-0.5 rounded hover:bg-accent"
          onClick={() => onAddShift(date)}
        >
          + Add
        </button>
      )}
    </div>
  );
}

export function WeeklyScheduleGrid({
  shifts: initialShifts,
  assignments: initialAssignments,
  employees,
  departments,
  branches,
  canEdit,
  currentBranchId,
}: ScheduleData) {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [shifts, setShifts] = useState<Shift[]>(initialShifts);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>(initialAssignments);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | undefined>();
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();
  const [publishing, setPublishing] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const visibleShifts = shifts.filter((s) => {
    const d = new Date(s.startTime);
    return d >= weekStart && d < addDays(weekStart, 7);
  });

  const unpublishedCount = visibleShifts.filter((s) => !s.isPublished).length;

  async function loadWeek(start: Date) {
    setWeekStart(start);
    const res = await fetch(`/api/shifts?weekStart=${start.toISOString()}`);
    if (res.ok) {
      const data: Shift[] = await res.json();
      setShifts(data);
    }
  }

  const handleDragEnd = useCallback(
    async ({ active, over }: DragEndEvent) => {
      if (!over || !canEdit) return;
      const shift = active.data.current?.shift as Shift;
      const targetDate = over.data.current?.date as Date;
      if (!shift || !targetDate) return;

      const origStart = new Date(shift.startTime);
      const origEnd = new Date(shift.endTime);
      const diffMs = origEnd.getTime() - origStart.getTime();

      const newStart = new Date(targetDate);
      newStart.setHours(origStart.getHours(), origStart.getMinutes());
      const newEnd = new Date(newStart.getTime() + diffMs);

      const res = await fetch(`/api/shifts/${shift.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startTime: newStart.toISOString(), endTime: newEnd.toISOString() }),
      });

      if (res.ok) {
        const updated: Shift = await res.json();
        setShifts((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      }
    },
    [canEdit]
  );

  async function handleDelete(shiftId: string) {
    const res = await fetch(`/api/shifts/${shiftId}`, { method: "DELETE" });
    if (res.ok) setShifts((prev) => prev.filter((s) => s.id !== shiftId));
  }

  function handleEdit(shift: Shift) {
    setEditingShift(shift);
    setDefaultDate(new Date(shift.startTime));
    setDialogOpen(true);
  }

  function handleAddShift(date: Date) {
    setEditingShift(undefined);
    setDefaultDate(date);
    setDialogOpen(true);
  }

  async function handlePublish() {
    setPublishing(true);
    await fetch("/api/shifts/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId: currentBranchId, weekStart: weekStart.toISOString() }),
    });
    setShifts((prev) =>
      prev.map((s) => {
        const d = new Date(s.startTime);
        return d >= weekStart && d < addDays(weekStart, 7) ? { ...s, isPublished: true } : s;
      })
    );
    setPublishing(false);
  }

  async function refreshWeek() {
    const res = await fetch(`/api/shifts?weekStart=${weekStart.toISOString()}`);
    if (res.ok) setShifts(await res.json());
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <WeekNavigator weekStart={weekStart} onWeekChange={loadWeek} />
        {canEdit && unpublishedCount > 0 && (
          <Button size="sm" onClick={handlePublish} disabled={publishing}>
            {publishing ? "Publishing…" : `Publish Week (${unpublishedCount} unpublished)`}
          </Button>
        )}
        {unpublishedCount === 0 && visibleShifts.length > 0 && (
          <Badge variant="secondary">Published</Badge>
        )}
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Header row */}
            <div className="grid grid-cols-7 border rounded-t-md bg-muted/50">
              {weekDays.map((day, i) => (
                <div
                  key={i}
                  className={`px-2 py-2 text-xs font-semibold text-center border-r last:border-r-0 ${
                    format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  <div>{DAY_LABELS[i]}</div>
                  <div className="text-base font-bold">{format(day, "d")}</div>
                </div>
              ))}
            </div>
            {/* Shift cells */}
            <div className="grid grid-cols-7 border border-t-0 rounded-b-md">
              {weekDays.map((day, i) => {
                const dayKey = format(day, "yyyy-MM-dd");
                const dayShifts = visibleShifts.filter(
                  (s) => format(new Date(s.startTime), "yyyy-MM-dd") === dayKey
                );
                const isPast = day < today;
                return (
                  <DayCell
                    key={i}
                    date={day}
                    shifts={dayShifts}
                    assignments={assignments}
                    employees={employees}
                    canEdit={canEdit}
                    isPast={isPast}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onAddShift={handleAddShift}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </DndContext>

      <ShiftCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        branchId={currentBranchId}
        defaultDate={defaultDate}
        departments={departments}
        employees={employees}
        shift={editingShift}
        assignments={editingShift ? assignments.filter((a) => a.shiftId === editingShift.id) : []}
        onSaved={refreshWeek}
      />
    </div>
  );
}
