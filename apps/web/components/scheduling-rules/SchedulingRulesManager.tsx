"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SchedulingRule } from "@scheduler/types";
import { extractErrorMessage } from "@/lib/utils/extract-error";

type Branch = { id: string; name: string };

type Props = {
  branches: Branch[];
  rules: SchedulingRule[];
};

export function SchedulingRulesManager({ branches, rules: initialRules }: Props) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [ruleText, setRuleText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const visibleRules = useMemo(
    () => rules.filter((r) => r.branchId === branchId),
    [rules, branchId]
  );

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!branchId || !ruleText.trim()) return;

    setLoading(true);
    setError("");

    const res = await fetch("/api/settings/scheduling-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId, ruleText: ruleText.trim() }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(extractErrorMessage(data.error));
      setLoading(false);
      return;
    }

    const created = await res.json();
    setRules([...rules, created]);
    setRuleText("");
    setLoading(false);
    router.refresh();
  }

  async function handleToggle(rule: SchedulingRule) {
    const res = await fetch(`/api/settings/scheduling-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    if (!res.ok) return;

    const updated = await res.json();
    setRules(rules.map((r) => (r.id === updated.id ? updated : r)));
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this scheduling rule?")) return;

    const res = await fetch(`/api/settings/scheduling-rules/${id}`, { method: "DELETE" });
    if (!res.ok) return;

    setRules(rules.filter((r) => r.id !== id));
    router.refresh();
  }

  if (branches.length === 0) {
    return <p className="text-sm text-muted-foreground">No branches available.</p>;
  }

  return (
    <div className="space-y-4">
      {branches.length > 1 && (
        <div className="w-64">
          <Select value={branchId} onValueChange={(v) => v && setBranchId(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <form onSubmit={handleAdd} className="space-y-2">
        <textarea
          value={ruleText}
          onChange={(e) => setRuleText(e.target.value)}
          placeholder='e.g. "Always assign at least 2 employees with the Chef role to shifts on Saturday and Sunday."'
          rows={3}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={loading || !ruleText.trim()}>
            {loading ? "Adding…" : "Add Rule"}
          </Button>
        </div>
      </form>

      <div className="grid gap-3">
        {visibleRules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No scheduling rules yet.</p>
        ) : (
          visibleRules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-card"
            >
              <p className={`text-sm ${rule.isActive ? "" : "text-muted-foreground line-through"}`}>
                {rule.ruleText}
              </p>
              <div className="flex items-center gap-3 shrink-0">
                <Switch checked={rule.isActive} onCheckedChange={() => handleToggle(rule)} />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(rule.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
