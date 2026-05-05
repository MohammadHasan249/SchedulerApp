"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CalendarCheck2, Clock, ArrowLeftRight, Users, BarChart2, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppUser } from "@/lib/auth/getUser";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: AppUser["role"][];
};

const BOTTOM_NAV: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard, roles: ["org_admin", "branch_manager", "employee"] },
  { label: "Schedule", href: "/dashboard/schedule", icon: CalendarDays, roles: ["org_admin", "branch_manager", "employee"] },
  { label: "Time Off", href: "/dashboard/time-off", icon: Clock, roles: ["org_admin", "branch_manager", "employee"] },
  { label: "Swaps", href: "/dashboard/shift-swaps", icon: ArrowLeftRight, roles: ["org_admin", "branch_manager", "employee"] },
  { label: "Team", href: "/dashboard/employees", icon: Users, roles: ["org_admin", "branch_manager"] },
  { label: "Reports", href: "/dashboard/reports", icon: BarChart2, roles: ["org_admin", "branch_manager"] },
];

function isActive(href: string, pathname: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

export function MobileBottomNav({ role }: { role: AppUser["role"] }) {
  const pathname = usePathname();
  const items = BOTTOM_NAV.filter((i) => i.roles.includes(role)).slice(0, 5);

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-10 bg-card border-t flex items-stretch h-16 safe-area-inset-bottom">
      {items.map(({ label, href, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
            isActive(href, pathname)
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className={cn("h-5 w-5", isActive(href, pathname) && "text-primary")} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
