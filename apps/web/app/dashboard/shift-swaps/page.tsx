import { getUser } from "@/lib/auth/getUser";
import { db } from "@/lib/db";
import { shiftSwapRequests, employees, shifts, branches, shiftAssignments } from "@scheduler/database/schema";
import { eq, and, or, inArray, gte } from "drizzle-orm";
import { ShiftSwapTable } from "@/components/shift-swaps/ShiftSwapTable";
import {
  serializeEmployee,
  serializeShift,
  serializeShiftSwap,
} from "@/lib/serialize";

export default async function ShiftSwapsPage() {
  const user = await getUser();
  const canApprove = user.role !== "employee";

  let swaps: typeof shiftSwapRequests.$inferSelect[] = [];
  let employeeRows: typeof employees.$inferSelect[] = [];
  let shiftRows: typeof shifts.$inferSelect[] = [];
  let mySwappableShiftRows: typeof shifts.$inferSelect[] = [];
  let currentEmployeeId: string | undefined;

  if (user.role === "employee") {
    const [emp] = await db
      .select()
      .from(employees)
      .where(and(eq(employees.authUserId, user.id), eq(employees.organizationId, user.organizationId)))
      .limit(1);

    if (emp) {
      currentEmployeeId = emp.id;

      // Employee sees swaps where they are requester or potential cover
      swaps = await db
        .select()
        .from(shiftSwapRequests)
        .where(
          or(
            eq(shiftSwapRequests.requesterId, emp.id),
            eq(shiftSwapRequests.coverId, emp.id)
          )
        );

      // Also surface open swaps for shifts they are assigned to
      const assignedShiftIds = (
        await db.select({ shiftId: shiftAssignments.shiftId }).from(shiftAssignments).where(eq(shiftAssignments.employeeId, emp.id))
      ).map((r) => r.shiftId);

      if (assignedShiftIds.length > 0) {
        const openSwaps = await db
          .select()
          .from(shiftSwapRequests)
          .where(
            and(
              inArray(shiftSwapRequests.shiftId, assignedShiftIds),
              eq(shiftSwapRequests.status, "pending")
            )
          );
        const existingIds = new Set(swaps.map((s) => s.id));
        for (const s of openSwaps) {
          if (!existingIds.has(s.id)) swaps.push(s);
        }

        // Upcoming shifts this employee is assigned to, for the "request a
        // swap" picker — separate from swapShiftIds below, which only covers
        // shifts already part of an existing swap.
        mySwappableShiftRows = await db
          .select()
          .from(shifts)
          .where(and(inArray(shifts.id, assignedShiftIds), gte(shifts.startTime, new Date())));
      }

      // Get all employees and shifts in the org for display
      employeeRows = await db.select().from(employees).where(eq(employees.organizationId, user.organizationId));
      const swapShiftIds = [...new Set(swaps.map((s) => s.shiftId))];
      if (swapShiftIds.length > 0) {
        shiftRows = await db.select().from(shifts).where(inArray(shifts.id, swapShiftIds));
      }
    }
  } else {
    const empConditions = [eq(employees.organizationId, user.organizationId)];
    if (user.role === "branch_manager" && user.branchId) {
      empConditions.push(eq(employees.branchId, user.branchId));
    }

    employeeRows = await db.select().from(employees).where(and(...empConditions));
    const empIds = employeeRows.map((e) => e.id);

    if (empIds.length > 0) {
      swaps = await db
        .select()
        .from(shiftSwapRequests)
        .where(inArray(shiftSwapRequests.requesterId, empIds));

      const swapShiftIds = [...new Set(swaps.map((s) => s.shiftId))];
      if (swapShiftIds.length > 0) {
        shiftRows = await db.select().from(shifts).where(inArray(shifts.id, swapShiftIds));
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Shift Swaps</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {canApprove ? "Review shift swap requests." : "Request and manage shift swaps."}
        </p>
      </div>
      <ShiftSwapTable
        swaps={swaps.map(serializeShiftSwap)}
        shifts={shiftRows.map((s) => serializeShift(s))}
        employees={employeeRows.map(serializeEmployee)}
        mySwappableShifts={mySwappableShiftRows.map((s) => serializeShift(s))}
        currentEmployeeId={currentEmployeeId}
        canApprove={canApprove}
      />
    </div>
  );
}
