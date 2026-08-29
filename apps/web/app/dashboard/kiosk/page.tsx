import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/getUser";
import { db } from "@/lib/db";
import { branches } from "@scheduler/database/schema";
import { eq } from "drizzle-orm";

export default async function KioskEntryPage() {
  const user = await getUser();

  if (user.role !== "org_admin" && user.role !== "branch_manager") {
    redirect("/dashboard");
  }

  const allBranches = await db
    .select({ id: branches.id, name: branches.name, slug: branches.slug })
    .from(branches)
    .where(eq(branches.organizationId, user.organizationId));

  const availableBranches =
    user.role === "branch_manager"
      ? allBranches.filter((b) => b.id === user.branchId)
      : allBranches;

  if (availableBranches.length === 1) {
    redirect(`/kiosk/${availableBranches[0].slug}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Clock In / Out</h1>
        <p className="text-muted-foreground text-sm mt-1">Choose a branch to open its kiosk.</p>
      </div>
      {availableBranches.length === 0 ? (
        <p className="text-sm text-muted-foreground">No branches found for your account.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 max-w-xl">
          {availableBranches.map((b) => (
            <Link
              key={b.id}
              href={`/kiosk/${b.slug}`}
              className="rounded-lg border px-4 py-3 text-sm font-medium hover:bg-accent transition-colors"
            >
              {b.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
