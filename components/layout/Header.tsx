import { UserMenu } from "./UserMenu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { type AppUser } from "@/lib/auth/getUser";

type Props = {
  user: AppUser;
  employeeId?: string;
};

export function Header({ user, employeeId }: Props) {
  return (
    <header className="h-14 border-b flex items-center justify-between px-6 shrink-0">
      <div />
      <div className="flex items-center gap-2">
        {employeeId && (
          <NotificationBell employeeId={employeeId} organizationId={user.organizationId} />
        )}
        <UserMenu user={user} />
      </div>
    </header>
  );
}
