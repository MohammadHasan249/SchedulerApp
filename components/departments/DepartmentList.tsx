"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Department, JobRole, Branch } from "@/db/schema";

type DeptWithRoles = Department & { jobRoles: JobRole[] };

type Props = {
  departments: DeptWithRoles[];
  branches: Branch[];
  currentUserRole: "org_admin" | "branch_manager" | "employee";
  currentUserBranchId?: string | null;
};

export function DepartmentList({ departments: initial, branches, currentUserRole, currentUserBranchId }: Props) {
  const router = useRouter();
  const [depts, setDepts] = useState<DeptWithRoles[]>(initial);

  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptBranchId, setNewDeptBranchId] = useState(currentUserBranchId ?? branches[0]?.id ?? "");
  const [addingDept, setAddingDept] = useState(false);

  const [newRoleNames, setNewRoleNames] = useState<Record<string, string>>({});
  const [addingRole, setAddingRole] = useState<Record<string, boolean>>({});
  const [renamingDept, setRenamingDept] = useState<Record<string, string>>({});

  const branchMap = Object.fromEntries(branches.map((b) => [b.id, b.name]));

  async function addDept() {
    if (!newDeptName.trim() || !newDeptBranchId) return;
    setAddingDept(true);
    const res = await fetch("/api/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newDeptName.trim(), branchId: newDeptBranchId }),
    });
    if (res.ok) {
      const dept: Department = await res.json();
      setDepts((prev) => [...prev, { ...dept, jobRoles: [] }]);
      setNewDeptName("");
    }
    setAddingDept(false);
  }

  async function renameDept(deptId: string) {
    const name = renamingDept[deptId]?.trim();
    if (!name) return;
    const res = await fetch(`/api/departments/${deptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setDepts((prev) => prev.map((d) => (d.id === deptId ? { ...d, name } : d)));
      setRenamingDept((prev) => { const n = { ...prev }; delete n[deptId]; return n; });
    }
  }

  async function deleteDept(deptId: string) {
    const res = await fetch(`/api/departments/${deptId}`, { method: "DELETE" });
    if (res.ok) setDepts((prev) => prev.filter((d) => d.id !== deptId));
  }

  async function addRole(deptId: string) {
    const name = newRoleNames[deptId]?.trim();
    if (!name) return;
    setAddingRole((prev) => ({ ...prev, [deptId]: true }));
    const res = await fetch(`/api/departments/${deptId}/job-roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const role: JobRole = await res.json();
      setDepts((prev) =>
        prev.map((d) => (d.id === deptId ? { ...d, jobRoles: [...d.jobRoles, role] } : d))
      );
      setNewRoleNames((prev) => ({ ...prev, [deptId]: "" }));
    }
    setAddingRole((prev) => ({ ...prev, [deptId]: false }));
  }

  async function deleteRole(deptId: string, roleId: string) {
    const res = await fetch(`/api/departments/${deptId}/job-roles/${roleId}`, { method: "DELETE" });
    if (res.ok) {
      setDepts((prev) =>
        prev.map((d) =>
          d.id === deptId ? { ...d, jobRoles: d.jobRoles.filter((r) => r.id !== roleId) } : d
        )
      );
    }
  }

  return (
    <div className="space-y-6">
      {currentUserRole !== "employee" && (
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="New department name…"
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            className="max-w-xs"
            onKeyDown={(e) => e.key === "Enter" && addDept()}
          />
          {currentUserRole === "org_admin" && (
            <Select value={newDeptBranchId} onValueChange={(v) => setNewDeptBranchId(v ?? "")}>
              <SelectTrigger className="w-44">
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
          )}
          <Button size="sm" onClick={addDept} disabled={addingDept}>
            Add Department
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {depts.map((dept) => (
          <Card key={dept.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                {renamingDept[dept.id] !== undefined ? (
                  <Input
                    value={renamingDept[dept.id]}
                    autoFocus
                    onChange={(e) =>
                      setRenamingDept((prev) => ({ ...prev, [dept.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") renameDept(dept.id);
                      if (e.key === "Escape")
                        setRenamingDept((prev) => { const n = { ...prev }; delete n[dept.id]; return n; });
                    }}
                    className="h-7 text-sm"
                  />
                ) : (
                  <CardTitle className="text-base">{dept.name}</CardTitle>
                )}
                {currentUserRole !== "employee" && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() =>
                        setRenamingDept((prev) => ({ ...prev, [dept.id]: dept.name }))
                      }
                    >
                      Rename
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => deleteDept(dept.id)}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{branchMap[dept.branchId] ?? "—"}</p>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {dept.jobRoles.map((role) => (
                  <Badge
                    key={role.id}
                    variant="secondary"
                    className="gap-1 cursor-pointer"
                    onClick={() => currentUserRole !== "employee" && deleteRole(dept.id, role.id)}
                  >
                    {role.name}
                    {currentUserRole !== "employee" && <span className="text-muted-foreground">×</span>}
                  </Badge>
                ))}
                {dept.jobRoles.length === 0 && (
                  <span className="text-xs text-muted-foreground">No job roles yet.</span>
                )}
              </div>
              {currentUserRole !== "employee" && (
                <div className="flex gap-1">
                  <Input
                    placeholder="Add job role…"
                    value={newRoleNames[dept.id] ?? ""}
                    onChange={(e) =>
                      setNewRoleNames((prev) => ({ ...prev, [dept.id]: e.target.value }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && addRole(dept.id)}
                    className="h-7 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => addRole(dept.id)}
                    disabled={addingRole[dept.id]}
                  >
                    Add
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {depts.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full">No departments yet.</p>
        )}
      </div>
    </div>
  );
}
