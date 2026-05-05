"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ShiftCard } from "./ShiftCard";
import { ShiftCreateDialog } from "./ShiftCreateDialog";
import { WeekNavigator } from "./WeekNavigator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Shift, ShiftAssignment, Employee, Branch } from "@scheduler/database/schema";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LABELS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type ScheduleData = {
  shifts: Shift[];
  assignments: ShiftAssignment[];
  employees: Employee[];
  branches: Branch[];
  availability: { id: string; employeeId: string; dayOfWeek: number; startTime: string; endTime: string }[];
  canEdit: boolean;
  currentBranchId: string;
  userRole: string;
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

function MobileDayView({
  day,
  shifts,
  assignments,
  employees,
  canEdit,
  onEdit,
  onDelete,
  onAddShift,
  onPrev,
  onNext,
}: {
  day: Date;
  shifts: Shift[];
  assignments: ShiftAssignment[];
  employees: Employee[];
  canEdit: boolean;
  onEdit: (shift: Shift) => void;
  onDelete: (id: string) => void;
  onAddShift: (date: Date) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = day < today;
  const isToday = isSameDay(day, new Date());

  const dayShifts = shifts.filter(
    (s) => format(new Date(s.startTime), "yyyy-MM-dd") === format(day, "yyyy-MM-dd")
  );

  return (
    <div className="space-y-4">
      {/* Day navigator */}
      <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
        <button
          onClick={onPrev}
          className="p-1.5 rounded-md hover:bg-accent transition-colors"
          aria-label="Previous day"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="text-center">
          <p className={`text-lg font-bold ${isToday ? "text-primary" : ""}`}>
            {format(day, "EEEE")}
          </p>
          <p className="text-sm text-muted-foreground">{format(day, "MMMM d, yyyy")}</p>
        </div>

        <button
          onClick={onNext}
          className="p-1.5 rounded-md hover:bg-accent transition-colors"
          aria-label="Next day"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Shifts for this day */}
      <div className="space-y-2">
        {dayShifts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No shifts scheduled for this day.
          </div>
        ) : (
          dayShifts.map((s) => (
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
          ))
        )}
      </div>

      {canEdit && !isPast && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => onAddShift(day)}
        >
          + Add Shift
        </Button>
      )}
    </div>
  );
}

export function WeeklyScheduleGrid({
  shifts: initialShifts,
  assignments: initialAssignments,
  employees,
  branches,
  availability,
  canEdit,
  currentBranchId,
  userRole,
}: ScheduleData) {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [shifts, setShifts] = useState<Shift[]>(initialShifts);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>(initialAssignments);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | undefined>();
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();
  const [publishing, setPublishing] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [aiAssigning, setAiAssigning] = useState(false);
  const [mobileDay, setMobileDay] = useState(new Date());

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    setShifts(initialShifts);
    setAssignments(initialAssignments);
  }, [initialShifts, initialAssignments]);

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

  async function handleAutoAssign() {
    setAutoAssigning(true);
    const weekEnd = addDays(weekStart, 7);
    try {
      const res = await fetch("/api/shifts/auto-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: currentBranchId,
          fromDate: weekStart.toISOString(),
          toDate: weekEnd.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Auto-assign failed");
      } else if (data.assignmentsCreated === 0) {
        toast.info("No assignments made — make sure shifts are unpublished and employees have availability set");
      } else {
        toast.success(`Assigned ${data.assignmentsCreated} employee${data.assignmentsCreated !== 1 ? "s" : ""} to shifts`);
        refreshWeek();
      }
    } catch {
      toast.error("Auto-assign failed — check your connection");
    } finally {
      setAutoAssigning(false);
    }
  }

  async function handleAiAssign() {
    setAiAssigning(true);
    const weekEnd = addDays(weekStart, 7);
    try {
      const res = await fetch("/api/shifts/auto-assign-llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: currentBranchId,
          fromDate: weekStart.toISOString(),
          toDate: weekEnd.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "AI assign failed");
      } else if (data.assignmentsCreated === 0) {
        toast.info("No assignments made — make sure shifts are unpublished and employees have availability set");
      } else {
        toast.success(`AI assigned ${data.assignmentsCreated} employee${data.assignmentsCreated !== 1 ? "s" : ""} to shifts`);
        refreshWeek();
      }
    } catch {
      toast.error("AI assign failed — check your connection");
    } finally {
      setAiAssigning(false);
    }
  }

  function refreshWeek() {
    router.refresh();
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Week navigator — hidden on mobile, shown on desktop */}
        <div className="hidden md:flex items-center gap-4 flex-wrap">
          <WeekNavigator weekStart={weekStart} onWeekChange={loadWeek} />
          {canEdit && (userRole === "org_admin" || userRole === "branch_manager") && (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAutoAssign} disabled={autoAssigning} variant="secondary">
                {autoAssigning ? "Auto-assigning…" : "Auto-assign"}
              </Button>
              <Button size="sm" onClick={handleAiAssign} disabled={aiAssigning} variant="outline">
                {aiAssigning ? "AI Assigning…" : "AI Assign"}
              </Button>
            </div>
          )}
          {canEdit && unpublishedCount > 0 && (
            <Button size="sm" onClick={handlePublish} disabled={publishing}>
              {publishing ? "Publishing…" : `Publish Week (${unpublishedCount} unpublished)`}
            </Button>
          )}
          {unpublishedCount === 0 && visibleShifts.length > 0 && (
            <Badge variant="secondary">Published</Badge>
          )}
        </div>

        {/* Mobile week controls */}
        <div className="flex md:hidden items-center gap-2 w-full flex-wrap">
          <WeekNavigator weekStart={weekStart} onWeekChange={loadWeek} />
          {canEdit && unpublishedCount > 0 && (
            <Button size="sm" onClick={handlePublish} disabled={publishing} className="flex-1">
              {publishing ? "Publishing…" : `Publish (${unpublishedCount})`}
            </Button>
          )}
          {canEdit && (userRole === "org_admin" || userRole === "branch_manager") && (
            <>
              <Button size="sm" onClick={handleAutoAssign} disabled={autoAssigning} variant="secondary" className="flex-1">
                {autoAssigning ? "Assigning…" : "Auto-assign"}
              </Button>
              <Button size="sm" onClick={handleAiAssign} disabled={aiAssigning} variant="outline" className="flex-1">
                {aiAssigning ? "AI…" : "AI Assign"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Desktop: 7-column week grid */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="hidden md:block overflow-x-auto" suppressHydrationWarning>
          <div className="min-w-[700px]">
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

      {/* Mobile: single day view */}
      <div className="md:hidden">
        {/* Day-of-week pill strip */}
        <div className="flex gap-1 overflow-x-auto pb-2 mb-2 scrollbar-hide">
          {weekDays.map((day, i) => {
            const isSelected = isSameDay(day, mobileDay);
            const isToday = isSameDay(day, new Date());
            const dayShiftCount = visibleShifts.filter(
              (s) => format(new Date(s.startTime), "yyyy-MM-dd") === format(day, "yyyy-MM-dd")
            ).length;
            return (
              <button
                key={i}
                onClick={() => setMobileDay(day)}
                className={`flex flex-col items-center px-3 py-2 rounded-xl min-w-[52px] transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : isToday
                    ? "bg-primary/10 text-primary"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase">{DAY_LABELS[i]}</span>
                <span className="text-lg font-bold leading-tight">{format(day, "d")}</span>
                {dayShiftCount > 0 && (
                  <span className={`text-[9px] font-medium mt-0.5 ${isSelected ? "text-primary-foreground/80" : "text-primary"}`}>
                    {dayShiftCount} shift{dayShiftCount !== 1 ? "s" : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <MobileDayView
          day={mobileDay}
          shifts={visibleShifts}
          assignments={assignments}
          employees={employees}
          canEdit={canEdit}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onAddShift={handleAddShift}
          onPrev={() => setMobileDay((d) => addDays(d, -1))}
          onNext={() => setMobileDay((d) => addDays(d, 1))}
        />
      </div>

      <ShiftCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        branchId={currentBranchId}
        defaultDate={defaultDate}
        employees={employees}
        availability={availability}
        shift={editingShift}
        assignments={editingShift ? assignments.filter((a) => a.shiftId === editingShift.id) : []}
        onSaved={refreshWeek}
      />
    </div>
  );
}
