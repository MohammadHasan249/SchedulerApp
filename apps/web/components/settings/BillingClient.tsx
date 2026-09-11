"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

type Transaction = {
  id: string;
  type: "monthly_grant" | "purchase" | "usage" | "refund";
  amount: number;
  createdAt: string;
};

type Props = {
  plan: "free" | "pro";
  monthlyUsed: number;
  monthlyAllowance: number | null;
  creditsBalance: number;
  minCredits: number;
  maxCredits: number;
  transactions: Transaction[];
};

const TRANSACTION_LABELS: Record<Transaction["type"], string> = {
  monthly_grant: "Monthly grant",
  purchase: "Credit purchase",
  usage: "AI assistant usage",
  refund: "Refund",
};

export function BillingClient({
  plan,
  monthlyUsed,
  monthlyAllowance,
  creditsBalance,
  minCredits,
  maxCredits,
  transactions,
}: Props) {
  const searchParams = useSearchParams();
  const checkoutResult = searchParams.get("checkout");
  const [quantity, setQuantity] = useState(minCredits);
  const [loadingAction, setLoadingAction] = useState<"subscription" | "credits" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(body: { type: "subscription" } | { type: "credits"; quantity: number }) {
    setError(null);
    setLoadingAction(body.type);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Could not start checkout.");
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.");
      setLoadingAction(null);
    }
  }

  const quantityValid = Number.isInteger(quantity) && quantity >= minCredits && quantity <= maxCredits;

  return (
    <div className="space-y-6">
      {checkoutResult === "success" && (
        <p className="text-sm text-green-600">Payment successful — your account has been updated.</p>
      )}
      {checkoutResult === "canceled" && (
        <p className="text-sm text-muted-foreground">Checkout was canceled.</p>
      )}

      <div className="rounded-lg border p-4 space-y-1">
        <p className="text-sm font-medium">
          Current plan: <span className="capitalize">{plan}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          AI assistant usage this month: {monthlyUsed}
          {monthlyAllowance !== null ? ` / ${monthlyAllowance}` : " (unlimited)"}
        </p>
        <p className="text-sm text-muted-foreground">Purchased credits remaining: {creditsBalance}</p>
      </div>

      <div className="rounded-lg border p-4 space-y-1 bg-muted/30">
        <h3 className="font-medium text-sm">What's a credit?</h3>
        <p className="text-sm text-muted-foreground">
          Each message you send the AI scheduling assistant uses 1 credit. Your plan includes a
          monthly allowance of credits that resets every month; once that runs out, any purchased
          credits below are used instead. Purchased credits never expire and roll over month to
          month.
        </p>
      </div>

      {plan === "free" && (
        <div className="rounded-lg border p-4 space-y-3">
          <div>
            <h3 className="font-medium">Upgrade to Pro</h3>
            <p className="text-sm text-muted-foreground">
              A larger monthly AI assistant allowance for your organization.
            </p>
          </div>
          <button
            onClick={() => startCheckout({ type: "subscription" })}
            disabled={loadingAction !== null}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {loadingAction === "subscription" ? "Redirecting…" : "Upgrade to Pro"}
          </button>
        </div>
      )}

      <div className="rounded-lg border p-4 space-y-3">
        <div>
          <h3 className="font-medium">Buy AI credits</h3>
          <p className="text-sm text-muted-foreground">
            Choose how many credits to buy ({minCredits}–{maxCredits}).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={minCredits}
            max={maxCredits}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="border rounded-md px-3 py-2 text-sm w-28"
          />
          <button
            onClick={() => startCheckout({ type: "credits", quantity })}
            disabled={loadingAction !== null || !quantityValid}
            className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {loadingAction === "credits" ? "Redirecting…" : `Buy ${Number.isFinite(quantity) ? quantity : ""} credits`}
          </button>
        </div>
        {!quantityValid && (
          <p className="text-sm text-destructive">
            Enter a whole number between {minCredits} and {maxCredits}.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-lg border p-4 space-y-3">
        <div>
          <h3 className="font-medium">Credit history</h3>
          <p className="text-sm text-muted-foreground">Recent grants, purchases, and credit usage.</p>
        </div>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No credit activity yet.</p>
        ) : (
          <ul className="divide-y">
            {transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p>{TRANSACTION_LABELS[t.type]}</p>
                  <p className="text-muted-foreground text-xs">
                    {new Date(t.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className={t.amount >= 0 ? "text-green-600" : "text-muted-foreground"}>
                  {t.amount >= 0 ? "+" : ""}
                  {t.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
