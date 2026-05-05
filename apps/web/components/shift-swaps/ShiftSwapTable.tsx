"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ShiftSwapRequest, Shift, Employee } from "@scheduler/database/schema";

type SwapWithDetails = ShiftSwapRequest & { shift?: Shift };

type Props = {
  swaps: SwapWithDetails[];
  shifts: Shift[];
  employees: Employee[];
  currentEmployeeId?: string;
  canApprove: boolean;
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  cover_accepted: "outline",
  manager_approved: "default",
  denied: "destructive",
};

export function ShiftSwapTable({ swaps, shifts, employees, currentEmployeeId, canApprove }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const empMap = Object.fromEntries(employees.map((e) => [e.id, e.name]));
  const shiftMap = Object.fromEntries(shifts.map((s) => [s.id, s]));

  async function doAction(id: string, action: string) {
    setLoading(id + action);
    await fetch(`/api/shift-swaps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Shift</TableHead>
            <TableHead>Requester</TableHead>
            <TableHead>Cover</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {swaps.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No swap requests.
              </TableCell>
            </TableRow>
          )}
          {swaps.map((swap) => {
            const shift = shiftMap[swap.shiftId];
            const isLoading = loading?.startsWith(swap.id);
            return (
              <TableRow key={swap.id}>
                <TableCell>
                  {shift
                    ? `${format(new Date(shift.startTime), "MMM d, HH:mm")}–${format(new Date(shift.endTime), "HH:mm")}`
                    : "—"}
                </TableCell>
                <TableCell>{empMap[swap.requesterId] ?? "—"}</TableCell>
                <TableCell>{swap.coverId ? empMap[swap.coverId] ?? "—" : "Open"}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[swap.status]}>
                    {swap.status.replace("_", " ").split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")}
                  </Badge>
                </TableCell>
                <TableCell>{format(new Date(swap.createdAt), "MMM d")}</TableCell>
                <TableCell className="text-right space-x-1">
                  {/* Cover employee can accept */}
                  {!canApprove &&
                    swap.status === "pending" &&
                    swap.requesterId !== currentEmployeeId &&
                    (!swap.coverId || swap.coverId === currentEmployeeId) && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!!isLoading}
                        onClick={() => doAction(swap.id, "accept_cover")}
                      >
                        Accept Cover
                      </Button>
                    )}
                  {/* Manager actions */}
                  {canApprove && swap.status === "cover_accepted" && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!!isLoading}
                        onClick={() => doAction(swap.id, "manager_approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={!!isLoading}
                        onClick={() => doAction(swap.id, "deny")}
                      >
                        Deny
                      </Button>
                    </>
                  )}
                  {canApprove && swap.status === "pending" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={!!isLoading}
                      onClick={() => doAction(swap.id, "deny")}
                    >
                      Deny
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
