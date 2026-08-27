"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { Branch } from "@scheduler/types";

type Props = {
  branches: Branch[];
  value: string;
  onChange: (branchId: string) => void;
  className?: string;
};

/**
 * Branch picker for org admins who oversee multiple branches — everything
 * scoped by branch (schedule, reports, etc.) should read the selection from
 * here rather than assuming a single branch. Branch managers and employees
 * only ever have one branch, so this collapses to a plain label for them.
 */
export function BranchSelector({ branches, value, onChange, className }: Props) {
  if (branches.length <= 1) {
    return branches[0] ? <Badge variant="outline">{branches[0].name}</Badge> : null;
  }

  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger size="sm" className={className ?? "w-[160px]"}>
        <SelectValue placeholder="Branch" />
      </SelectTrigger>
      <SelectContent>
        {branches.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
