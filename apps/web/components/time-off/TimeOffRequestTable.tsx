"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TimeOffRequestForm } from "./TimeOffRequestForm";
import type { TimeOffRequest, Employee } from "@scheduler/types";

type RequestWithEmployee = TimeOffRequest & { employee?: Employee };

// req.startDate/endDate are plain "yyyy-MM-dd" strings. `new Date(str)` parses
// that as UTC midnight, which `format()` then renders in the browser's local
// timezone — shifting the displayed date back a day west of UTC. Parse the
// components directly as a local date instead.
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

type Props = {
  requests: RequestWithEmployee[];
  canApprove: boolean;
  employees?: Employee[];
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  denied: "destructive",
};

export function TimeOffRequestTable({ requests, canApprove, employees = [] }: Props) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const empMap = Object.fromEntries(employees.map((e) => [e.id, e.name]));

  async function updateStatus(id: string, status: "approved" | "denied") {
    if (pendingIds.has(id)) return;
    setPendingIds((prev) => new Set(prev).add(id));
    try {
      await fetch(`/api/time-off/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function deleteRequest(id: string, status: string) {
    if (status !== "pending" && !window.confirm("Cancel this time-off request?")) return;
    await fetch(`/api/time-off/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {!canApprove && (
          <Button size="sm" onClick={() => setFormOpen(true)}>
            + Request Time Off
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {canApprove && <TableHead>Employee</TableHead>}
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No requests found.
                </TableCell>
              </TableRow>
            )}
            {requests.map((req) => (
              <TableRow key={req.id}>
                {canApprove && <TableCell>{empMap[req.employeeId] ?? "—"}</TableCell>}
                <TableCell>{format(parseLocalDate(req.startDate), "MMM d, yyyy")}</TableCell>
                <TableCell>{format(parseLocalDate(req.endDate), "MMM d, yyyy")}</TableCell>
                <TableCell className="max-w-xs truncate">{req.reason ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[req.status]}>
                    {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>{format(new Date(req.createdAt), "MMM d")}</TableCell>
                <TableCell className="text-right space-x-1">
                  {canApprove && req.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pendingIds.has(req.id)}
                        onClick={() => updateStatus(req.id, "approved")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={pendingIds.has(req.id)}
                        onClick={() => updateStatus(req.id, "denied")}
                      >
                        Deny
                      </Button>
                    </>
                  )}
                  {!canApprove && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteRequest(req.id, req.status)}
                    >
                      Cancel
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TimeOffRequestForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
