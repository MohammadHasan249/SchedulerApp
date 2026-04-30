import { format } from "date-fns";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/getUser";
import { KioskContent } from "@/components/kiosk/KioskContent";

export default async function KioskPage({ params }: { params: Promise<{ branchSlug: string }> }) {
  const user = await getUser();

  // Only org_admin and branch_manager can access the kiosk
  if (user.role !== "org_admin" && user.role !== "branch_manager") {
    redirect("/dashboard");
  }

  const { branchSlug } = await params;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Clock In / Out</h1>
        <p className="text-muted-foreground mt-1">{format(new Date(), "EEEE, MMMM d · HH:mm")}</p>
      </div>

      <KioskContent branchSlug={branchSlug} />
    </div>
  );
}
