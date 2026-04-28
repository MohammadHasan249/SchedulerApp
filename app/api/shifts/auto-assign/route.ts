import { NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth/getUser";
import { autoAssignShifts } from "@/lib/scheduling/auto-assign";

const autoAssignSchema = z.object({
  branchId: z.string().uuid(),
  fromDate: z.string().datetime(),
  toDate: z.string().datetime(),
});

export async function POST(request: Request) {
  const user = await getUser();

  if (user.role === "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (user.role === "branch_manager" && !user.branchId) {
    return NextResponse.json(
      { error: "Branch manager must have a branch assigned" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const parsed = autoAssignSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { branchId, fromDate, toDate } = parsed.data;

  // Branch managers can only auto-assign their own branch
  if (user.role === "branch_manager" && branchId !== user.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const assignments = await autoAssignShifts(
      user.organizationId,
      branchId,
      new Date(fromDate),
      new Date(toDate)
    );

    return NextResponse.json(
      {
        success: true,
        assignmentsCreated: assignments.length,
        assignments,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in auto-assign:", error);
    return NextResponse.json(
      { error: "Failed to auto-assign shifts" },
      { status: 500 }
    );
  }
}
