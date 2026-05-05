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
import type { TimeOffRequest, Employee } from "@scheduler/database/schema";

type RequestWithEmployee = TimeOffRequest & { employee?: Employee };

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

  const empMap = Object.fromEntries(employees.map((e) => [e.id, e.name]));

  async function updateStatus(id: string, status: "approved" | "denied") {
    await fetch(`/api/time-off/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function deleteRequest(id: string) {
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
                <TableCell>{format(new Date(req.startDate), "MMM d, yyyy")}</TableCell>
                <TableCell>{format(new Date(req.endDate), "MMM d, yyyy")}</TableCell>
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
                      <Button size="sm" variant="ghost" onClick={() => updateStatus(req.id, "approved")}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => updateStatus(req.id, "denied")}
                      >
                        Deny
                      </Button>
                    </>
                  )}
                  {!canApprove && req.status === "pending" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteRequest(req.id)}
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
