import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { creditTransactions, type CreditTransaction } from "@scheduler/database/schema";

const RECENT_TRANSACTIONS_LIMIT = 20;

/** Most recent credit-ledger events for an org's billing history view. */
export async function getRecentTransactions(organizationId: string): Promise<CreditTransaction[]> {
  return db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.organizationId, organizationId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(RECENT_TRANSACTIONS_LIMIT);
}
