"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Users,
  Layers,
  Clock,
  ArrowLeftRight,
  BarChart2,
  Settings,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type AppUser } from "@/lib/auth/getUser";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: AppUser["role"][];
};

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: BarChart2, roles: ["org_admin", "branch_manager", "employee"] },
  { label: "Schedule", href: "/dashboard/schedule", icon: CalendarDays, roles: ["org_admin", "branch_manager", "employee"] },
  { label: "Time Off", href: "/dashboard/time-off", icon: Clock, roles: ["org_admin", "branch_manager", "employee"] },
  { label: "Shift Swaps", href: "/dashboard/shift-swaps", icon: ArrowLeftRight, roles: ["org_admin", "branch_manager", "employee"] },
  { label: "Employees", href: "/dashboard/employees", icon: Users, roles: ["org_admin", "branch_manager"] },
  { label: "Departments", href: "/dashboard/departments", icon: Layers, roles: ["org_admin", "branch_manager"] },
  { label: "Reports", href: "/dashboard/reports", icon: BarChart2, roles: ["org_admin", "branch_manager"] },
  { label: "Branches", href: "/dashboard/settings/branches", icon: GitBranch, roles: ["org_admin"] },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, roles: ["org_admin"] },
];

export function Sidebar({ role }: { role: AppUser["role"] }) {
  const pathname = usePathname();
  const visible = NAV.filter((item) => item.roles.includes(role));

  return (
    <aside className="w-56 shrink-0 border-r bg-card flex flex-col">
      <div className="h-14 flex items-center px-4 border-b font-semibold text-sm tracking-wide">
        Scheduler
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {visible.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
