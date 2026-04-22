import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth/getUser";
import { requireRole } from "@/lib/auth/requireRole";
import { db } from "@/lib/db";
import { employees, branches } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const roleLabel: Record<string, string> = {
  org_admin: "Org Admin",
  branch_manager: "Branch Manager",
  employee: "Employee",
};

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const user = await getUser();
  requireRole(user, "org_admin", "branch_manager");

  const { employeeId } = await params;

  const conditions = [
    eq(employees.id, employeeId),
    eq(employees.organizationId, user.organizationId),
  ];
  if (user.role === "branch_manager" && user.branchId) {
    conditions.push(eq(employees.branchId, user.branchId));
  }

  const [employee] = await db
    .select()
    .from(employees)
    .where(and(...conditions))
    .limit(1);

  if (!employee) notFound();

  const branchRows = await db
    .select()
    .from(branches)
    .where(eq(branches.organizationId, user.organizationId));

  const branchMap = Object.fromEntries(branchRows.map((b) => [b.id, b.name]));

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{employee.name}</h1>
        <p className="text-muted-foreground text-sm">{employee.email}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Role">
            <Badge variant="secondary">{roleLabel[employee.role]}</Badge>
          </Row>
          <Row label="Branch">{employee.branchId ? branchMap[employee.branchId] ?? "—" : "—"}</Row>
          <Row label="Max hrs/week">{employee.maxHoursPerWeek}</Row>
          <Row label="Kiosk PIN">{employee.pinHash ? "Set" : "Not set"}</Row>
          <Row label="Status">
            <Badge variant={employee.isActive ? "default" : "outline"}>
              {employee.isActive ? "Active" : "Inactive"}
            </Badge>
          </Row>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}
