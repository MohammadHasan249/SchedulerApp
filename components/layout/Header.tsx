import { UserMenu } from "./UserMenu";
import { type AppUser } from "@/lib/auth/getUser";

export function Header({ user }: { user: AppUser }) {
  return (
    <header className="h-14 border-b flex items-center justify-between px-6 shrink-0">
      <div />
      <UserMenu user={user} />
    </header>
  );
}
