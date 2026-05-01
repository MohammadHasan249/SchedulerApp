import { format } from "date-fns";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/getUser";
import { db } from "@/lib/db";
import { employees } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { KioskContent } from "@/components/kiosk/KioskContent";

export default async function KioskPage({ params }: { params: Promise<{ branchSlug: string }> }) {
  const user = await getUser();

  // Only org_admin and branch_manager can access the kiosk
  if (user.role !== "org_admin" && user.role !== "branch_manager") {
    redirect("/dashboard");
  }

  const { branchSlug } = await params;

  // Get admin's employee record to check if they have a PIN
  const [adminEmployee] = await db
    .select({ id: employees.id, pinHash: employees.pinHash })
    .from(employees)
    .where(
      and(
        eq(employees.authUserId, user.id),
        eq(employees.organizationId, user.organizationId)
      )
    )
    .limit(1);

  const needsPinSetup = adminEmployee && !adminEmployee.pinHash;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Clock In / Out</h1>
        <p className="text-muted-foreground mt-1">{format(new Date(), "EEEE, MMMM d · HH:mm")}</p>
      </div>

      <KioskContent
        branchSlug={branchSlug}
        adminEmployeeId={adminEmployee?.id}
        needsPinSetup={needsPinSetup ?? false}
      />
    </div>
  );
}
