import { getUser } from "@/lib/auth/getUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Users, Clock, ArrowLeftRight } from "lucide-react";

export default async function DashboardPage() {
  const user = await getUser();

  const cards = [
    { title: "Schedule", description: "View and manage shifts", icon: CalendarDays, href: "/dashboard/schedule" },
    { title: "Employees", description: "Manage your team", icon: Users, href: "/dashboard/employees" },
    { title: "Time Off", description: "Review time-off requests", icon: Clock, href: "/dashboard/time-off" },
    { title: "Shift Swaps", description: "Manage swap requests", icon: ArrowLeftRight, href: "/dashboard/shift-swaps" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Welcome back, {user.email}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ title, description, icon: Icon, href }) => (
          <a key={href} href={href}>
            <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
              <CardHeader className="pb-2">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
