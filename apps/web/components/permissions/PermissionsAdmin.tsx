"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  type PermissionKey,
  type PermissionProfile,
} from "@scheduler/types";

type EmployeeLite = {
  id: string;
  name: string;
  email: string;
  permissionProfileId: string | null;
};

const NONE = "__none__";

export function PermissionsAdmin({
  initialProfiles,
  initialEmployees,
}: {
  initialProfiles: PermissionProfile[];
  initialEmployees: EmployeeLite[];
}) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [employees, setEmployees] = useState(initialEmployees);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newPerms, setNewPerms] = useState<Set<PermissionKey>>(new Set());
  const [creating, setCreating] = useState(false);

  async function api(path: string, init?: RequestInit) {
    const res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(typeof d?.error === "string" ? d.error : "Request failed");
    }
    return res.status === 204 ? null : res.json();
  }

  async function createProfile() {
    setError(null);
    if (!newName.trim()) {
      setError("Give the profile a name.");
      return;
    }
    setCreating(true);
    try {
      const created: PermissionProfile = await api("/api/permission-profiles", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), permissions: [...newPerms] }),
      });
      setProfiles((p) => [...p, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      setNewPerms(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the profile.");
    } finally {
      setCreating(false);
    }
  }

  async function togglePerm(profile: PermissionProfile, key: PermissionKey, on: boolean) {
    setError(null);
    const next = on
      ? [...new Set([...profile.permissions, key])]
      : profile.permissions.filter((k) => k !== key);
    // optimistic
    setProfiles((ps) => ps.map((p) => (p.id === profile.id ? { ...p, permissions: next } : p)));
    try {
      await api(`/api/permission-profiles/${profile.id}`, {
        method: "PATCH",
        body: JSON.stringify({ permissions: next }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update permissions.");
      setProfiles((ps) => ps.map((p) => (p.id === profile.id ? profile : p))); // revert
    }
  }

  async function deleteProfile(id: string) {
    setError(null);
    const prevProfiles = profiles;
    const prevEmployees = employees;
    setProfiles((ps) => ps.filter((p) => p.id !== id));
    // Affected employees fall back to no profile (FK set null).
    setEmployees((es) =>
      es.map((e) => (e.permissionProfileId === id ? { ...e, permissionProfileId: null } : e))
    );
    try {
      await api(`/api/permission-profiles/${id}`, { method: "DELETE" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete the profile.");
      setProfiles(prevProfiles);
      setEmployees(prevEmployees);
    }
  }

  async function assign(employeeId: string, value: string) {
    setError(null);
    const permissionProfileId = value === NONE ? null : value;
    const prev = employees;
    setEmployees((es) =>
      es.map((e) => (e.id === employeeId ? { ...e, permissionProfileId } : e))
    );
    try {
      await api(`/api/employees/${employeeId}`, {
        method: "PATCH",
        body: JSON.stringify({ permissionProfileId }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't assign the profile.");
      setEmployees(prev);
    }
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-destructive text-sm">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>New profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input
              className="max-w-xs"
              placeholder="e.g. Shift Lead"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Permissions</Label>
            {PERMISSION_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={newPerms.has(key)}
                  onCheckedChange={(c) =>
                    setNewPerms((s) => {
                      const next = new Set(s);
                      if (c) next.add(key);
                      else next.delete(key);
                      return next;
                    })
                  }
                />
                {PERMISSION_LABELS[key]}
              </label>
            ))}
          </div>
          <Button size="sm" onClick={createProfile} disabled={creating}>
            {creating ? "Creating…" : "Create profile"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profiles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {profiles.length === 0 && (
            <p className="text-muted-foreground text-sm">No profiles yet.</p>
          )}
          {profiles.map((profile) => (
            <div key={profile.id} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{profile.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteProfile(profile.id)}
                  aria-label={`Delete ${profile.name}`}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
              <div className="flex flex-col gap-1.5">
                {PERMISSION_KEYS.map((key) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={profile.permissions.includes(key)}
                      onCheckedChange={(c) => togglePerm(profile, key, Boolean(c))}
                    />
                    {PERMISSION_LABELS[key]}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assign profiles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {employees.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No managers or staff to assign. (Org admins already have every permission.)
            </p>
          )}
          {employees.map((emp) => {
            const value = emp.permissionProfileId ?? NONE;
            const selected = profiles.find((p) => p.id === emp.permissionProfileId);
            return (
              <div key={emp.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{emp.name}</div>
                  <div className="text-muted-foreground text-xs truncate">{emp.email}</div>
                </div>
                <Select value={value} onValueChange={(v) => assign(emp.id, v ?? NONE)}>
                  <SelectTrigger className="w-44">
                    <SelectValue>{selected ? selected.name : "No profile"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No profile</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
          {employees.some((e) => e.permissionProfileId) && (
            <div className="flex flex-wrap gap-1 pt-1">
              {PERMISSION_KEYS.map((k) => (
                <Badge key={k} variant="secondary">
                  {PERMISSION_LABELS[k]}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
