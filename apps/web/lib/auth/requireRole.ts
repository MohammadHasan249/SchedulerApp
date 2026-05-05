import { redirect } from "next/navigation";
import { type AppUser } from "./getUser";

type Role = AppUser["role"];

export function requireRole(user: AppUser, ...roles: Role[]) {
  if (!roles.includes(user.role)) {
    redirect("/dashboard");
  }
}
