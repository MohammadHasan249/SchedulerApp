"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Users,
  Clock,
  ArrowLeftRight,
  BarChart2,
  Settings,
  GitBranch,
  CalendarCheck2,
  Briefcase,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type AppUser } from "@/lib/auth/getUser";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: AppUser["role"][];
  group?: string;
};

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: BarChart2, roles: ["org_admin", "branch_manager", "employee"], group: "main" },
  { label: "Schedule", href: "/dashboard/schedule", icon: CalendarDays, roles: ["org_admin", "branch_manager", "employee"], group: "main" },
  { label: "Availability", href: "/dashboard/availability", icon: CalendarCheck2, roles: ["org_admin", "branch_manager", "employee"], group: "main" },
  { label: "Time Off", href: "/dashboard/time-off", icon: Clock, roles: ["org_admin", "branch_manager", "employee"], group: "main" },
  { label: "Shift Swaps", href: "/dashboard/shift-swaps", icon: ArrowLeftRight, roles: ["org_admin", "branch_manager", "employee"], group: "main" },
  { label: "Employees", href: "/dashboard/employees", icon: Users, roles: ["org_admin", "branch_manager"], group: "manage" },
  { label: "Reports", href: "/dashboard/reports", icon: BarChart2, roles: ["org_admin", "branch_manager"], group: "manage" },
  { label: "Job Roles", href: "/dashboard/settings/job-roles", icon: Briefcase, roles: ["org_admin"], group: "settings" },
  { label: "Branches", href: "/dashboard/settings/branches", icon: GitBranch, roles: ["org_admin"], group: "settings" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, roles: ["org_admin"], group: "settings" },
];

const GROUP_LABELS: Record<string, string> = {
  main: "Workspace",
  manage: "Management",
  settings: "Settings",
};

function isActive(href: string, pathname: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/dashboard/settings") return pathname === "/dashboard/settings";
  return pathname.startsWith(href);
}

type Props = {
  role: AppUser["role"];
  isOpen?: boolean;
  onClose?: () => void;
};

export function Sidebar({ role, isOpen = false, onClose }: Props) {
  const pathname = usePathname();
  const visible = NAV.filter((item) => item.roles.includes(role));
  const groups = ["main", "manage", "settings"] as const;

  return (
    <aside
      className={cn(
        // Mobile: fixed overlay, slide in/out
        "fixed inset-y-0 left-0 z-30 w-72 flex flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300",
        isOpen ? "translate-x-0" : "-translate-x-full",
        // Desktop: relative, always visible, narrower
        "lg:relative lg:w-60 lg:translate-x-0 lg:shrink-0"
      )}
    >
      {/* Logo + mobile close */}
      <div className="h-14 flex items-center px-5 shrink-0 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 flex-1">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
            <CalendarDays className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-sm tracking-wide text-sidebar-foreground">
            Scheduler
          </span>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-1 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {groups.map((group) => {
          const items = visible.filter((i) => i.group === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                {GROUP_LABELS[group]}
              </p>
              <div className="space-y-0.5">
                {items.map(({ label, href, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                      isActive(href, pathname)
                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
