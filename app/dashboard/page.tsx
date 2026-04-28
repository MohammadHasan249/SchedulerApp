import { getUser } from "@/lib/auth/getUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Users, Clock, ArrowLeftRight, CalendarCheck2, BarChart2, Watch } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { employees, branches } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const ALL_CARDS = [
  {
    title: "Schedule",
    description: "View and manage this week's shifts",
    icon: CalendarDays,
    href: "/dashboard/schedule",
    color: "bg-primary/10 text-primary",
    roles: ["org_admin", "branch_manager", "employee"],
  },
  {
    title: "Availability",
    description: "Set your weekly availability",
    icon: CalendarCheck2,
    href: "/dashboard/availability",
    color: "bg-violet-500/10 text-violet-600",
    roles: ["org_admin", "branch_manager", "employee"],
  },
  {
    title: "Time Off",
    description: "Request or review time-off",
    icon: Clock,
    href: "/dashboard/time-off",
    color: "bg-amber-500/10 text-amber-600",
    roles: ["org_admin", "branch_manager", "employee"],
  },
  {
    title: "Shift Swaps",
    description: "Manage swap requests",
    icon: ArrowLeftRight,
    href: "/dashboard/shift-swaps",
    color: "bg-teal-500/10 text-teal-600",
    roles: ["org_admin", "branch_manager", "employee"],
  },
  {
    title: "Employees",
    description: "Manage your team members",
    icon: Users,
    href: "/dashboard/employees",
    color: "bg-rose-500/10 text-rose-600",
    roles: ["org_admin", "branch_manager"],
  },
  {
    title: "Reports",
    description: "Attendance and hours overview",
    icon: BarChart2,
    href: "/dashboard/reports",
    color: "bg-primary/10 text-primary",
    roles: ["org_admin", "branch_manager"],
  },
  {
    title: "Clock In/Out",
    description: "Use the time clock to punch in",
    icon: Watch,
    href: null,
    color: "bg-green-500/10 text-green-600",
    roles: ["employee"],
  },
] as const;

export default async function DashboardPage() {
  const user = await getUser();

  const [emp] = await db
    .select({ branchId: employees.branchId })
    .from(employees)
    .where(and(eq(employees.authUserId, user.id), eq(employees.organizationId, user.organizationId)))
    .limit(1);

  let kioskHref = null;
  if (emp?.branchId) {
    const [branch] = await db
      .select({ slug: branches.slug })
      .from(branches)
      .where(eq(branches.id, emp.branchId))
      .limit(1);
    if (branch) {
      kioskHref = `/kiosk/${branch.slug}`;
    }
  }

  const cards = ALL_CARDS.filter((c) => c.roles.includes(user.role as never)).map((card) =>
    card.title === "Clock In/Out" && kioskHref ? { ...card, href: kioskHref } : card
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Here's what's happening with your team today.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ title, description, icon: Icon, href, color }) => {
          const card = (
            <Card className="group hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer h-full">
              <CardHeader className="pb-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-2 ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors">
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          );

          return href ? (
            <Link key={href} href={href}>
              {card}
            </Link>
          ) : (
            <div key={title} className="opacity-50 cursor-not-allowed">
              {card}
            </div>
          );
        })}
      </div>
    </div>
  );
}
