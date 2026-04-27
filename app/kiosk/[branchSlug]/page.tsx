import { format } from "date-fns";
import { KioskContent } from "@/components/kiosk/KioskContent";

export default async function KioskPage({ params }: { params: Promise<{ branchSlug: string }> }) {
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
