import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import bcryptjs from "bcryptjs";
import { db } from "@/lib/db";
import { employees, branches, jobRoles } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { sendEmployeeInvitationEmail } from "@/lib/email/send-employee-invitation";
import { generateUniquePin } from "@/lib/employees";
import { eq, and, gt } from "drizzle-orm";

const inviteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["org_admin", "branch_manager", "employee"]).default("employee"),
  branchId: z.string().uuid().nullable().optional(),
  jobRoleId: z.string().uuid().nullable().optional(),
  maxHoursPerWeek: z.number().int().min(1).max(168).default(40),
});

const PAGE_SIZE = 100;

export const GET = withAuth(async function GET(request: Request) {
  const user = await getUser();

  if (user.role === "branch_manager" && !user.branchId) {
    return NextResponse.json({ data: [], nextCursor: null });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor"); // last seen employee id

  const conditions = [eq(employees.organizationId, user.organizationId)];
  if (user.role === "branch_manager") {
    conditions.push(eq(employees.branchId, user.branchId!));
  }
  if (cursor) {
    conditions.push(gt(employees.id, cursor));
  }

  // Employees only get their own record — the full roster (emails,
  // availability) is for managers and admins. Still wrapped in the same
  // { data, nextCursor } envelope so self-lookup clients handle it uniformly.
  if (user.role === "employee") {
    conditions.push(eq(employees.authUserId, user.id));
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
      availabilitySchedule: employees.availabilitySchedule,
    })
    .from(employees)
    .where(and(...conditions))
    .orderBy(employees.id)
    .limit(PAGE_SIZE + 1);

  const hasMore = rows.length > PAGE_SIZE;
  const data = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return NextResponse.json({ data, nextCursor });
});

export const POST = withAuth(async function POST(request: Request) {
  const user = await getUser();

  if (user.role === "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, role, branchId, jobRoleId, maxHoursPerWeek } = parsed.data;

  if (user.role === "branch_manager" && role !== "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Only org_admin can create another org_admin
  if (role === "org_admin" && user.role !== "org_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const targetBranchId =
    user.role === "branch_manager" ? user.branchId : (branchId ?? null);

  // Branch managers and employees are scoped to one branch throughout the
  // app — only an org admin can be branch-less (they oversee everything).
  if (role !== "org_admin" && !targetBranchId) {
    return NextResponse.json({ error: "branchId is required for this role" }, { status: 400 });
  }

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

  const pin = await generateUniquePin(user.organizationId, targetBranchId);
  const pinHash = await bcryptjs.hash(pin, 10);

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
      email: email.trim().toLowerCase(),
      role,
      jobRoleId: jobRoleId ?? null,
      maxHoursPerWeek,
      pinHash,
      availabilitySchedule: defaultSchedule,
    })
    .returning({
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
      availabilitySchedule: employees.availabilitySchedule,
      permissionProfileId: employees.permissionProfileId,
    });

  let emailSent = false;
  try {
    const result = await sendEmployeeInvitationEmail(name, email, user.organizationId, pin);
    emailSent = result.sent;
  } catch (error) {
    logger.error("Failed to send invitation email:", error);
  }

  return NextResponse.json({ ...employee, emailSent }, { status: 201 });
});
