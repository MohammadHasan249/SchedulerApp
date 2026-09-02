"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Employee, Branch, JobRole } from "@scheduler/types";
import { extractErrorMessage } from "@/lib/utils/extract-error";
import { toast } from "sonner";

const roleLabel: Record<string, string> = {
  org_admin: "Org Admin",
  branch_manager: "Branch Manager",
  employee: "Employee",
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee?: Employee;
  branches: Branch[];
  jobRoles: JobRole[];
  currentUserRole: "org_admin" | "branch_manager" | "employee";
  currentUserBranchId?: string | null;
};

export function EmployeeForm({ open, onOpenChange, employee, branches, jobRoles, currentUserRole, currentUserBranchId }: Props) {
  const router = useRouter();
  const isEdit = !!employee;

  const [name, setName] = useState(employee?.name ?? "");
  const [email, setEmail] = useState(employee?.email ?? "");
  const [role, setRole] = useState<"org_admin" | "branch_manager" | "employee">(employee?.role ?? "employee");
  const [branchId, setBranchId] = useState<string>(employee?.branchId ?? "");
  const [maxHours, setMaxHours] = useState(String(employee?.maxHoursPerWeek ?? 40));
  const [jobRoleId, setJobRoleId] = useState<string>(employee?.jobRoleId ?? "");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const availableBranches =
    currentUserRole === "branch_manager"
      ? branches.filter((b) => b.id === currentUserBranchId)
      : branches;

  useEffect(() => {
    if (open) {
      if (employee) {
        setName(employee.name);
        setEmail(employee.email);
        setRole(employee.role);
        setBranchId(employee.branchId ?? (employee.role === "org_admin" ? "" : currentUserBranchId ?? ""));
        setMaxHours(String(employee.maxHoursPerWeek));
        setJobRoleId(employee.jobRoleId ?? "");
        setPin("");
      } else {
        setName("");
        setEmail("");
        setRole("employee");
        setBranchId(currentUserRole === "branch_manager" ? currentUserBranchId ?? "" : "");
        setMaxHours("40");
        setJobRoleId("");
        setPin("");
      }
      setError("");
    }
  }, [open, employee, currentUserRole, currentUserBranchId]);

  // Only an org admin can go without a branch — a branch manager or
  // employee's whole app experience is scoped to their branch.
  useEffect(() => {
    if (role === "org_admin") {
      setBranchId("");
    } else if (!branchId && availableBranches.length === 1) {
      setBranchId(availableBranches[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (role !== "org_admin" && !branchId) {
      setError("Select a branch for this role");
      return;
    }

    setLoading(true);
    setError("");

    const payload: Record<string, unknown> = {
      name,
      role,
      maxHoursPerWeek: parseInt(maxHours),
      branchId: branchId || null,
      jobRoleId: jobRoleId || null,
    };

    if (!isEdit) {
      payload.email = email;
    }

    if (pin) payload.pin = pin;

    const url = isEdit ? `/api/employees/${employee.id}` : "/api/employees";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(extractErrorMessage(data.error));
      setLoading(false);
      return;
    }

    const data = await res.json();
    if (!isEdit && data.emailSent === false) {
      toast.warning(`${name} was added, but the invitation email couldn't be sent. Share their PIN with them directly.`);
    }

    setLoading(false);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Employee" : "Invite Employee"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="emp-name">Name</Label>
            <Input id="emp-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          {!isEdit && (
            <div className="space-y-1">
              <Label htmlFor="emp-email">Email</Label>
              <Input id="emp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          )}

          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger>
                <SelectValue placeholder="Select role">{roleLabel[role]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {isEdit && currentUserRole === "org_admin" && (
                  <SelectItem value="org_admin">Org Admin</SelectItem>
                )}
                {currentUserRole === "org_admin" && (
                  <SelectItem value="branch_manager">Branch Manager</SelectItem>
                )}
                <SelectItem value="employee">Employee</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Branch{role !== "org_admin" && " *"}</Label>
            <Select
              value={branchId}
              onValueChange={(v) => setBranchId(v ?? "")}
              disabled={role === "org_admin"}
            >
              <SelectTrigger>
                <SelectValue placeholder={role === "org_admin" ? "Whole organization" : "Select a branch"}>
                  {role === "org_admin"
                    ? "Whole organization"
                    : branchId
                    ? branches.find((b) => b.id === branchId)?.name
                    : "Select a branch"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableBranches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {role === "org_admin" && (
              <p className="text-xs text-muted-foreground">Org admins oversee every branch, not just one.</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Job Role (optional)</Label>
            <Select value={jobRoleId} onValueChange={(v) => setJobRoleId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="None">
                  {jobRoleId ? jobRoles.find((r) => r.id === jobRoleId)?.name : "None"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {jobRoles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="emp-hours">Max hours/week</Label>
            <Input
              id="emp-hours"
              type="number"
              min={1}
              max={168}
              value={maxHours}
              onChange={(e) => setMaxHours(e.target.value)}
            />
          </div>

          {isEdit && (
            <div className="space-y-1">
              <Label htmlFor="emp-pin">Kiosk PIN (4 digits) — optional</Label>
              <Input
                id="emp-pin"
                type="password"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Leave blank to skip"
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : isEdit ? "Save" : "Invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
