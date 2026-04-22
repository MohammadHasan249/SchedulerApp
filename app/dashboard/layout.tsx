import { getUser } from "@/lib/auth/getUser";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { OrgContextProvider } from "@/components/providers/OrgContext";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  return (
    <OrgContextProvider user={user}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar role={user.role} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header user={user} />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </OrgContextProvider>
  );
}
