"use client";

import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { type AppUser } from "@/lib/auth/getUser";

export function UserMenu({ user }: { user: AppUser }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = user.email[0].toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:opacity-80 transition-opacity">
        <Avatar className="h-9 w-9 border border-border">
          <AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
            {initial}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal py-2">
            <p className="text-sm font-medium break-all">{user.email}</p>
            <p className="text-xs text-muted-foreground capitalize mt-1">{user.role.replace("_", " ")}</p>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={signOut} className="cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
