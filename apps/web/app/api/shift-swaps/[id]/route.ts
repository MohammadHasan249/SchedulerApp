import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { db } from "@/lib/db";
import { shiftSwapRequests, employees, shifts, branches, shiftAssignments } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { createNotifications } from "@/lib/notifications";
import { eq, and } from "drizzle-orm";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept_cover") }),
  z.object({ action: z.literal("manager_approve") }),
  z.object({ action: z.literal("deny") }),
]);

async function getSwap(id: string, organizationId: string) {
  const [row] = await db
    .select({ swap: shiftSwapRequests, requester: employees, shift: shifts, branch: branches })
    .from(shiftSwapRequests)
    .innerJoin(employees, eq(shiftSwapRequests.requesterId, employees.id))
    .innerJoin(shifts, eq(shiftSwapRequests.shiftId, shifts.id))
    .innerJoin(branches, eq(shifts.branchId, branches.id))
    .where(and(eq(shiftSwapRequests.id, id), eq(branches.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

async function getEmployeeForUser(userId: string, organizationId: string) {
  const [emp] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.authUserId, userId), eq(employees.organizationId, organizationId)))
    .limit(1);
  return emp ?? null;
}

export const PATCH = withAuth(async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  const { id } = await params;

  const row = await getSwap(id, user.organizationId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { action } = parsed.data;
  const { swap } = row;

  if (action === "accept_cover") {
    // Only the cover employee can accept
    if (user.role !== "employee") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const emp = await getEmployeeForUser(user.id, user.organizationId);
    if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Must be the nominated cover, or any employee if no cover nominated
    if (swap.coverId && swap.coverId !== emp.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Cover must be in the same branch as the shift
    if (row.branch.id && emp.branchId !== row.branch.id) {
      return NextResponse.json({ error: "Cover must be in the same branch as the shift" }, { status: 409 });
    }

    // Cannot cover your own swap
    if (emp.id === swap.requesterId) {
      return NextResponse.json({ error: "Cannot cover your own swap request" }, { status: 409 });
    }

    if (swap.status !== "pending") {
      return NextResponse.json({ error: "Swap is not pending" }, { status: 409 });
    }

    const [updated] = await db
      .update(shiftSwapRequests)
      .set({ status: "cover_accepted", coverId: emp.id })
      .where(eq(shiftSwapRequests.id, id))
      .returning();

    await createNotifications([
      {
        employeeId: updated.requesterId,
        organizationId: user.organizationId,
        message: `${emp.name} has accepted your shift swap. Awaiting manager approval.`,
      },
    ]);

    return NextResponse.json(updated);
  }

  if (action === "manager_approve" || action === "deny") {
    if (user.role === "employee") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (user.role === "branch_manager" && (!user.branchId || row.branch.id !== user.branchId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (action === "manager_approve" && swap.status !== "cover_accepted") {
      return NextResponse.json({ error: "Cover must accept before manager approval" }, { status: 409 });
    }

    if (swap.status === "manager_approved" || swap.status === "denied") {
      return NextResponse.json({ error: "Swap is already finalized" }, { status: 409 });
    }

    const managerEmp = await getEmployeeForUser(user.id, user.organizationId);

    if (action === "deny") {
      const [updated] = await db
        .update(shiftSwapRequests)
        .set({ status: "denied", managerId: managerEmp?.id ?? null })
        .where(eq(shiftSwapRequests.id, id))
        .returning();
      const notifyTargets = [updated.requesterId, updated.coverId].filter(
        (x): x is string => !!x
      );
      await createNotifications(
        notifyTargets.map((employeeId) => ({
          employeeId,
          organizationId: user.organizationId,
          message: "A shift swap request was denied by a manager.",
        }))
      );
      return NextResponse.json(updated);
    }

    // manager_approve: actually perform the swap atomically.
    if (!swap.coverId) {
      return NextResponse.json(
        { error: "Cannot approve a swap with no cover" },
        { status: 409 }
      );
    }

    // The cover may have been assigned to this shift (another slot) since
    // accepting; the insert below would then hit the (shiftId, employeeId)
    // unique constraint and 500. Reject up front with a real answer.
    const [coverAlreadyAssigned] = await db
      .select({ id: shiftAssignments.id })
      .from(shiftAssignments)
      .where(
        and(
          eq(shiftAssignments.shiftId, swap.shiftId),
          eq(shiftAssignments.employeeId, swap.coverId)
        )
      )
      .limit(1);
    if (coverAlreadyAssigned) {
      return NextResponse.json(
        { error: "Cover employee is already assigned to this shift" },
        { status: 409 }
      );
    }

    let updated;
    try {
      updated = await db.transaction(async (tx) => {
        const [requesterAssignment] = await tx
          .select()
          .from(shiftAssignments)
          .where(
            and(
              eq(shiftAssignments.shiftId, swap.shiftId),
              eq(shiftAssignments.employeeId, swap.requesterId)
            )
          )
          .limit(1);

        if (!requesterAssignment) {
          throw new Error("Requester is no longer assigned to this shift");
        }

        await tx
          .delete(shiftAssignments)
          .where(eq(shiftAssignments.id, requesterAssignment.id));

        await tx.insert(shiftAssignments).values({
          shiftId: swap.shiftId,
          employeeId: swap.coverId!,
          jobRoleId: requesterAssignment.jobRoleId,
        });

        const [row] = await tx
          .update(shiftSwapRequests)
          .set({ status: "manager_approved", managerId: managerEmp?.id ?? null })
          .where(eq(shiftSwapRequests.id, id))
          .returning();

        return row;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to approve swap";
      return NextResponse.json({ error: message }, { status: 409 });
    }

    await createNotifications([
      {
        employeeId: updated.requesterId,
        organizationId: user.organizationId,
        message: "Your shift swap request was approved.",
      },
      {
        employeeId: updated.coverId!,
        organizationId: user.organizationId,
        message: "You've been assigned a shift through an approved swap.",
      },
    ]);

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
});
