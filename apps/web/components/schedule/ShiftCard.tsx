"use client";

import { format } from "date-fns";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Shift, ShiftAssignment, Employee } from "@scheduler/database/schema";

type Props = {
  shift: Shift;
  assignments: ShiftAssignment[];
  employees: Employee[];
  isPast: boolean;
  canEdit: boolean;
  onEdit: (shift: Shift) => void;
  onDelete: (shiftId: string) => void;
};

export function ShiftCard({ shift, assignments, employees, isPast, canEdit, onEdit, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: shift.id,
    disabled: isPast || !canEdit,
    data: { shift },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1 }
    : undefined;

  const empMap = Object.fromEntries(employees.map((e) => [e.id, e.name]));
  const assignedNames = assignments.map((a) => empMap[a.employeeId] ?? "Unknown");

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded border bg-primary/10 border-primary/30 p-1.5 text-xs cursor-grab select-none ${
        isPast ? "opacity-60 cursor-default" : ""
      } ${isDragging ? "ring-2 ring-primary" : ""}`}
    >
      <div className="font-semibold text-primary">
        {format(new Date(shift.startTime), "HH:mm")}–{format(new Date(shift.endTime), "HH:mm")}
      </div>
      {assignedNames.length > 0 && (
        <div className="text-muted-foreground truncate">{assignedNames.join(", ")}</div>
      )}
      {!isPast && canEdit && (
        <div className="flex gap-1 mt-1">
          <button
            className="text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); onEdit(shift); }}
          >
            Edit
          </button>
          <button
            className="text-destructive hover:text-destructive/80"
            onClick={(e) => { e.stopPropagation(); onDelete(shift.id); }}
          >
            Del
          </button>
        </div>
      )}
    </div>
  );
}
