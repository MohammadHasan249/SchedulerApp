import { getUser } from "@/lib/auth/getUser";
import { requireRole } from "@/lib/auth/requireRole";
import { db } from "@/lib/db";
import { availability, employees } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { AvailabilityEditor } from "@/components/availability/AvailabilityEditor";
import { TeamAvailabilityView } from "@/components/availability/TeamAvailabilityView";

export default async function AvailabilityPage() {
  const user = await getUser();

  // For managers/admins, show team availability view
  if (user.role === "org_admin" || user.role === "branch_manager") {
    const empConditions = [eq(employees.organizationId, user.organizationId)];
    if (user.role === "branch_manager" && user.branchId) {
      empConditions.push(eq(employees.branchId, user.branchId));
    }

    const teamEmployees = await db
      .select()
      .from(employees)
      .where(and(...empConditions));

    const teamEmployeeIds = teamEmployees.map((e) => e.id);
    const availabilityRows =
      teamEmployeeIds.length > 0
        ? await db
            .select()
            .from(availability)
            .where(inArray(availability.employeeId, teamEmployeeIds))
        : [];

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Team Availability</h1>
          <p className="text-muted-foreground text-sm mt-1">
            View availability for team members.
          </p>
        </div>
        <TeamAvailabilityView employees={teamEmployees} availability={availabilityRows} />
      </div>
    );
  }

  // For employees, show their own availability editor
  const [employee] = await db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.authUserId, user.id),
        eq(employees.organizationId, user.organizationId)
      )
    )
    .limit(1);

  if (!employee) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Availability</h1>
        <p className="text-muted-foreground text-sm">No employee profile found.</p>
      </div>
    );
  }

  const rows = await db
    .select()
    .from(availability)
    .where(eq(availability.employeeId, employee.id));

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Availability</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Set your weekly recurring availability.
        </p>
      </div>
      <AvailabilityEditor employeeId={employee.id} initial={rows} />
    </div>
  );
}
