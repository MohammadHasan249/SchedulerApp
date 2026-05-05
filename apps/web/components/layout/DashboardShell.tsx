"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileBottomNav } from "./MobileBottomNav";
import type { AppUser } from "@/lib/auth/getUser";

type Props = {
  user: AppUser;
  employeeId?: string;
  employeeName?: string;
  orgName?: string;
  children: React.ReactNode;
};

export function DashboardShell({ user, employeeId, employeeName, orgName, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        role={user.role}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header
          user={user}
          employeeId={employeeId}
          employeeName={employeeName}
          orgName={orgName}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
          {children}
        </main>
        <MobileBottomNav role={user.role} />
      </div>
    </div>
  );
}
