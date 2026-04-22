"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Branch } from "@/db/schema";

type ClockRow = {
  event: { id: string; type: "clock_in" | "clock_out"; timestamp: Date | string; branchId: string };
  employee: { id: string; name: string; email: string };
};

type Props = {
  initialRows: ClockRow[];
  branches: Branch[];
};

export function AttendanceLog({ initialRows, branches }: Props) {
  const [rows, setRows] = useState<ClockRow[]>(initialRows);
  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);

  async function handleFetch() {
    setLoading(true);
    const params = new URLSearchParams();
    if (branchId) params.set("branchId", branchId);
    params.set("from", new Date(from).toISOString());
    params.set("to", new Date(`${to}T23:59:59`).toISOString());

    const res = await fetch(`/api/clock?${params}`);
    if (res.ok) setRows(await res.json());
    setLoading(false);
  }

  const branchMap = Object.fromEntries(branches.map((b) => [b.id, b.name]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label>Branch</Label>
          <Select value={branchId} onValueChange={(v) => setBranchId(v ?? "")}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
        </div>
        <div className="space-y-1">
          <Label>To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" />
        </div>
        <Button onClick={handleFetch} disabled={loading}>
          {loading ? "Loading…" : "Filter"}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No clock events for the selected period.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.event.id}>
                <TableCell>
                  <div className="font-medium">{row.employee.name}</div>
                  <div className="text-xs text-muted-foreground">{row.employee.email}</div>
                </TableCell>
                <TableCell>{branchMap[row.event.branchId] ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={row.event.type === "clock_in" ? "default" : "secondary"}>
                    {row.event.type === "clock_in" ? "Clock In" : "Clock Out"}
                  </Badge>
                </TableCell>
                <TableCell>{format(new Date(row.event.timestamp), "MMM d, HH:mm:ss")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
