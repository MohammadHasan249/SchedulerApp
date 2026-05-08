import { Menu } from "lucide-react";
import { UserMenu } from "./UserMenu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { type AppUser } from "@/lib/auth/getUser";

type Props = {
  user: AppUser;
  employeeId?: string;
  employeeName?: string;
  onMenuClick?: () => void;
};

export function Header({ user, employeeId, employeeName, onMenuClick }: Props) {
  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 md:px-6 shrink-0 shadow-sm">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <span className="text-sm font-semibold text-foreground">
          {employeeName ? `Welcome back, ${employeeName}` : "Welcome back!"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {employeeId && (
          <NotificationBell employeeId={employeeId} organizationId={user.organizationId} />
        )}
        <UserMenu user={user} />
      </div>
    </header>
  );
}
