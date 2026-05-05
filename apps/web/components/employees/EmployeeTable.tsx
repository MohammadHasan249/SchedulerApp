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
import type { Employee, Branch, JobRole } from "@scheduler/database/schema";

type Props = {
  employees: Employee[];
  branches: Branch[];
  jobRoles: JobRole[];
  currentUserRole: "org_admin" | "branch_manager" | "employee";
  currentUserBranchId?: string | null;
};

const roleLabel: Record<string, string> = {
  org_admin: "Org Admin",
  branch_manager: "Branch Manager",
  employee: "Employee",
};

export function EmployeeTable({ employees, branches, jobRoles, currentUserRole, currentUserBranchId }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("active");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | undefined>();

  const branchMap = Object.fromEntries(branches.map((b) => [b.id, b.name]));
  const jobRoleMap = Object.fromEntries(jobRoles.map((r) => [r.id, r.name]));

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

  async function handleActivate(id: string) {
    await fetch(`/api/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
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
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
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
        <div className="sm:ml-auto">
          <Button size="sm" onClick={openNew} className="w-full sm:w-auto">
            + Invite Employee
          </Button>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-10 text-sm">No employees found.</p>
        )}
        {filtered.map((emp) => (
          <div
            key={emp.id}
            className={`rounded-xl border bg-card p-4 space-y-3 ${!emp.isActive ? "opacity-50" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{emp.name}</p>
                <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
              </div>
              <Badge variant={emp.isActive ? "default" : "outline"} className="shrink-0">
                {emp.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">{roleLabel[emp.role]}</Badge>
              {emp.branchId && (
                <Badge variant="outline">{branchMap[emp.branchId] ?? "—"}</Badge>
              )}
              {emp.jobRoleId && (
                <Badge variant="outline">{jobRoleMap[emp.jobRoleId] ?? "—"}</Badge>
              )}
              <span className="text-muted-foreground">{emp.maxHoursPerWeek}h/wk</span>
            </div>

            <div className="flex gap-2 pt-1 border-t">
              <Button size="sm" variant="ghost" className="flex-1" onClick={() => openEdit(emp)}>
                Edit
              </Button>
              {currentUserRole === "org_admin" && (
                emp.isActive ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 text-destructive hover:text-destructive"
                    onClick={() => handleDeactivate(emp.id)}
                  >
                    Deactivate
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => handleActivate(emp.id)}>
                    Activate
                  </Button>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Job Role</TableHead>
              <TableHead>Max hrs/wk</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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
                <TableCell>{emp.jobRoleId ? jobRoleMap[emp.jobRoleId] ?? "—" : "—"}</TableCell>
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
                  {currentUserRole === "org_admin" && (
                    <>
                      {emp.isActive ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeactivate(emp.id)}
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => handleActivate(emp.id)}>
                          Activate
                        </Button>
                      )}
                    </>
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
        jobRoles={jobRoles}
        currentUserRole={currentUserRole}
        currentUserBranchId={currentUserBranchId}
      />
    </div>
  );
}
