import { NextResponse } from "next/server";
import { z } from "zod";
import bcryptjs from "bcryptjs";
import { db } from "@/lib/db";
import { employees, branches, jobRoles } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { sendEmployeeInvitationEmail } from "@/lib/email/send-employee-invitation";
import { eq, and } from "drizzle-orm";

const inviteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["org_admin", "branch_manager", "employee"]).default("employee"),
  branchId: z.string().uuid().nullable().optional(),
  jobRoleId: z.string().uuid().nullable().optional(),
  maxHoursPerWeek: z.number().int().min(1).max(168).default(40),
  pin: z.string().regex(/^\d{4,6}$/).optional(),
});

export const GET = withAuth(async function GET() {
  const user = await getUser();

  if (user.role === "branch_manager" && !user.branchId) {
    return NextResponse.json([]);
  }

  const conditions = [eq(employees.organizationId, user.organizationId)];

  if (user.role === "branch_manager") {
    conditions.push(eq(employees.branchId, user.branchId!));
  }

  const rows = await db
    .select({
      id: employees.id,
      organizationId: employees.organizationId,
      branchId: employees.branchId,
      authUserId: employees.authUserId,
      name: employees.name,
      email: employees.email,
      role: employees.role,
      jobRoleId: employees.jobRoleId,
      maxHoursPerWeek: employees.maxHoursPerWeek,
      isActive: employees.isActive,
    })
    .from(employees)
    .where(and(...conditions));

  return NextResponse.json(rows);
});

export const POST = withAuth(async function POST(request: Request) {
  const user = await getUser();

  if (user.role === "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, role, branchId, jobRoleId, maxHoursPerWeek, pin } = parsed.data;

  if (user.role === "branch_manager" && role !== "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Only org_admin can create another org_admin
  if (role === "org_admin" && user.role !== "org_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const targetBranchId =
    user.role === "branch_manager" ? user.branchId : (branchId ?? null);

  // Verify branchId belongs to this organization (prevent cross-tenant assignment)
  if (targetBranchId) {
    const [branch] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, targetBranchId), eq(branches.organizationId, user.organizationId)))
      .limit(1);
    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }
  }

  // Verify jobRoleId belongs to this organization
  if (jobRoleId) {
    const [jr] = await db
      .select({ id: jobRoles.id })
      .from(jobRoles)
      .where(and(eq(jobRoles.id, jobRoleId), eq(jobRoles.organizationId, user.organizationId)))
      .limit(1);
    if (!jr) {
      return NextResponse.json({ error: "Job role not found" }, { status: 404 });
    }
  }

  const pinHash = pin ? await bcryptjs.hash(pin, 10) : null;

  // Initialize default availability schedule for all 7 days (9am-11pm)
  const defaultSchedule: Record<number, { startTime: string; endTime: string }> = {};
  for (let i = 0; i < 7; i++) {
    defaultSchedule[i] = { startTime: "09:00", endTime: "23:00" };
  }

  const [employee] = await db
    .insert(employees)
    .values({
      organizationId: user.organizationId,
      branchId: targetBranchId,
      authUserId: null,
      name,
      email,
      role,
      jobRoleId: jobRoleId ?? null,
      maxHoursPerWeek,
      pinHash,
      availabilitySchedule: defaultSchedule,
    })
    .returning();

  sendEmployeeInvitationEmail(name, email, user.organizationId).catch((error) => {
    console.error("Failed to send invitation email:", error);
  });

  return NextResponse.json(employee, { status: 201 });
});
