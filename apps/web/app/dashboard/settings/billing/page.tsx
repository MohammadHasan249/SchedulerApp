import { getUser } from "@/lib/auth/getUser";
import { getOrCreateBilling } from "@/lib/billing/get-or-create-billing";
import { getDisplayUsage } from "@/lib/billing/ai-usage";
import { getMonthlyAllowance, MIN_CREDIT_PURCHASE, MAX_CREDIT_PURCHASE } from "@/lib/billing/plan-limits";
import { getRecentTransactions } from "@/lib/billing/transactions";
import { BillingClient } from "@/components/settings/BillingClient";

export default async function BillingSettingsPage() {
  const user = await getUser();

  if (user.role !== "org_admin") {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Only organization admins can manage billing.
        </p>
      </div>
    );
  }

  const billing = await getOrCreateBilling(user.organizationId);
  const allowance = getMonthlyAllowance(billing.plan);
  const { monthlyUsed } = getDisplayUsage(billing);
  const transactions = await getRecentTransactions(user.organizationId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your plan and AI assistant usage.
        </p>
      </div>

      <div className="max-w-2xl">
        <BillingClient
          plan={billing.plan}
          monthlyUsed={monthlyUsed}
          monthlyAllowance={allowance}
          creditsBalance={billing.creditsBalance}
          minCredits={MIN_CREDIT_PURCHASE}
          maxCredits={MAX_CREDIT_PURCHASE}
          transactions={transactions.map((t) => ({
            id: t.id,
            type: t.type,
            amount: t.amount,
            createdAt: t.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
