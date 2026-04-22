"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmployeeForm } from "./EmployeeForm";
import type { Employee, Branch } from "@/db/schema";

type Props = {
  employees: Employee[];
  branches: Branch[];
  currentUserRole: "org_admin" | "branch_manager" | "employee";
  currentUserBranchId?: string | null;
};

const roleLabel: Record<string, string> = {
  org_admin: "Org Admin",
  branch_manager: "Branch Manager",
  employee: "Employee",
};

export function EmployeeTable({ employees, branches, currentUserRole, currentUserBranchId }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("active");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | undefined>();

  const branchMap = Object.fromEntries(branches.map((b) => [b.id, b.name]));

  const filtered = employees.filter((e) => {
    const matchSearch =
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase());
    const matchActive =
      filterActive === "all" ||
      (filterActive === "active" ? e.isActive : !e.isActive);
    return matchSearch && matchActive;
  });

  async function handleDeactivate(id: string) {
    await fetch(`/api/employees/${id}`, { method: "DELETE" });
    router.refresh();
  }

  function openEdit(emp: Employee) {
    setEditing(emp);
    setFormOpen(true);
  }

  function openNew() {
    setEditing(undefined);
    setFormOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-1">
          {(["all", "active", "inactive"] as const).map((v) => (
            <Button
              key={v}
              size="sm"
              variant={filterActive === v ? "default" : "outline"}
              onClick={() => setFilterActive(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </Button>
          ))}
        </div>
        <div className="ml-auto">
          <Button size="sm" onClick={openNew}>
            + Invite Employee
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Max hrs/wk</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No employees found.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((emp) => (
              <TableRow key={emp.id} className={!emp.isActive ? "opacity-50" : ""}>
                <TableCell className="font-medium">{emp.name}</TableCell>
                <TableCell>{emp.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{roleLabel[emp.role]}</Badge>
                </TableCell>
                <TableCell>{emp.branchId ? branchMap[emp.branchId] ?? "—" : "—"}</TableCell>
                <TableCell>{emp.maxHoursPerWeek}</TableCell>
                <TableCell>
                  <Badge variant={emp.isActive ? "default" : "outline"}>
                    {emp.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(emp)}>
                    Edit
                  </Button>
                  {currentUserRole === "org_admin" && emp.isActive && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeactivate(emp.id)}
                    >
                      Deactivate
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EmployeeForm
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={editing}
        branches={branches}
        currentUserRole={currentUserRole}
        currentUserBranchId={currentUserBranchId}
      />
    </div>
  );
}
