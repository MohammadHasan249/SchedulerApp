import { getUser } from "@/lib/auth/getUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Users, Clock, ArrowLeftRight, CalendarCheck2, BarChart2 } from "lucide-react";
import Link from "next/link";

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
] as const;

export default async function DashboardPage() {
  const user = await getUser();
  const cards = ALL_CARDS.filter((c) => c.roles.includes(user.role as never));

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
        {cards.map(({ title, description, icon: Icon, href, color }) => (
          <Link key={href} href={href}>
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
          </Link>
        ))}
      </div>
    </div>
  );
}
