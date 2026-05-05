"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Employee } from "@scheduler/database/schema";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type AvailabilityRow = {
  id: string;
  employeeId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type Props = {
  employees: Employee[];
  availability: AvailabilityRow[];
};

export function TeamAvailabilityView({ employees, availability }: Props) {
  const availabilityMap = new Map<string, Map<number, { startTime: string; endTime: string }[]>>();

  for (const emp of employees) {
    availabilityMap.set(emp.id, new Map());
    for (let i = 0; i < 7; i++) {
      availabilityMap.get(emp.id)?.set(i, []);
    }
  }

  for (const avail of availability) {
    const empMap = availabilityMap.get(avail.employeeId);
    if (empMap) {
      const daySlots = empMap.get(avail.dayOfWeek) || [];
      daySlots.push({ startTime: avail.startTime, endTime: avail.endTime });
      empMap.set(avail.dayOfWeek, daySlots);
    }
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Employee</TableHead>
            {DAYS.map((day) => (
              <TableHead key={day} className="text-xs text-center">
                {day.slice(0, 3)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((emp) => (
            <TableRow key={emp.id}>
              <TableCell className="font-medium text-sm">{emp.name}</TableCell>
              {DAYS.map((_, dayIndex) => {
                const slots = availabilityMap.get(emp.id)?.get(dayIndex) || [];
                return (
                  <TableCell key={`${emp.id}-${dayIndex}`} className="text-xs text-center">
                    {slots.length > 0 ? (
                      <div className="space-y-0.5">
                        {slots.map((slot, i) => (
                          <div key={i} className="text-muted-foreground">
                            {slot.startTime}–{slot.endTime}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
