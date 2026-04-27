import { UserMenu } from "./UserMenu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { type AppUser } from "@/lib/auth/getUser";

type Props = {
  user: AppUser;
  employeeId?: string;
  employeeName?: string;
  orgName?: string;
};

export function Header({ user, employeeId, employeeName, orgName }: Props) {
  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-6 shrink-0 shadow-sm">
      <div className="flex flex-col leading-tight">
        {orgName && (
          <span className="text-[10px] font-semibold uppercase tracking-widest text-primary/70">
            {orgName}
          </span>
        )}
        <span className="text-sm font-semibold text-foreground">
          {employeeName ? `Welcome back, ${employeeName}` : "Welcome back!"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {employeeId && (
          <NotificationBell employeeId={employeeId} organizationId={user.organizationId} />
        )}
        <UserMenu user={user} />
      </div>
    </header>
  );
}
