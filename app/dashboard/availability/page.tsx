import { getUser } from "@/lib/auth/getUser";
import { db } from "@/lib/db";
import { availability, employees } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { AvailabilityEditor } from "@/components/availability/AvailabilityEditor";

export default async function AvailabilityPage() {
  const user = await getUser();

  // Find the employee row for this auth user
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
        <h1 className="text-2xl font-semibold">My Availability</h1>
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
