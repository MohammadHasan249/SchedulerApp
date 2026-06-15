"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PayRate, PayType } from "@scheduler/types";

function formatAmount(cents: number, currency: string, payType: PayType): string {
  const formatted = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    minimumFractionDigits: payType === "hourly" ? 2 : 0,
    maximumFractionDigits: payType === "hourly" ? 2 : 0,
  }).format(cents / 100);
  return `${formatted}${payType === "hourly" ? "/hr" : "/yr"}`;
}

// "YYYY-MM-DD" -> local Date (avoids the UTC-parse off-by-one near midnight).
function parseDateOnly(d: string): Date {
  return new Date(`${d}T00:00:00`);
}

export function CompensationCard({
  employeeId,
  canEdit,
}: {
  employeeId: string;
  canEdit: boolean;
}) {
  const [rates, setRates] = useState<PayRate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [payType, setPayType] = useState<PayType>("hourly");
  const [amount, setAmount] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/employees/${employeeId}/pay-rates`);
      if (!res.ok) {
        setError("Couldn't load compensation.");
        return;
      }
      setRates(await res.json());
    } catch {
      setError("Couldn't load compensation.");
    }
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/employees/${employeeId}/pay-rates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payType,
          amountCents: Math.round(dollars * 100),
          effectiveDate,
          note: note.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(typeof d?.error === "string" ? d.error : "Couldn't save the rate.");
        return;
      }
      setAmount("");
      setNote("");
      setShowForm(false);
      await load();
    } catch {
      setError("Couldn't save the rate.");
    } finally {
      setSubmitting(false);
    }
  }

  const current = rates?.[0] ?? null; // API returns newest first

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Compensation</CardTitle>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancel" : "Add rate"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {error && <p className="text-destructive">{error}</p>}

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Current rate</span>
          <span className="font-medium">
            {current ? (
              <span className="flex items-center gap-2">
                {formatAmount(current.amountCents, current.currency, current.payType)}
                <Badge variant="secondary">{current.payType}</Badge>
              </span>
            ) : (
              "Not set"
            )}
          </span>
        </div>

        {canEdit && showForm && (
          <form onSubmit={handleSubmit} className="space-y-3 rounded-md border p-3">
            <div className="space-y-1">
              <Label>Pay type</Label>
              <Select value={payType} onValueChange={(v) => setPayType((v as PayType) ?? "hourly")}>
                <SelectTrigger className="w-full">
                  <SelectValue>{payType === "hourly" ? "Hourly" : "Salary"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="salary">Salary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Amount (CAD {payType === "hourly" ? "per hour" : "per year"})</Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step={payType === "hourly" ? "0.25" : "100"}
                placeholder={payType === "hourly" ? "e.g. 21.50" : "e.g. 55000"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Effective date</Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Note (optional)</Label>
              <Input
                placeholder="e.g. annual raise"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Saving…" : "Save rate"}
            </Button>
          </form>
        )}

        {rates && rates.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              History
            </p>
            {rates.map((r) => (
              <div key={r.id} className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {format(parseDateOnly(r.effectiveDate), "MMM d, yyyy")}
                </span>
                <span className="font-medium">
                  {formatAmount(r.amountCents, r.currency, r.payType)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
