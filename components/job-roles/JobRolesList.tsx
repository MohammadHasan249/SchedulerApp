"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { JobRole } from "@/db/schema";

type Props = {
  roles: JobRole[];
};

export function JobRolesList({ roles: initialRoles }: Props) {
  const router = useRouter();
  const [roles, setRoles] = useState(initialRoles);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<JobRole | undefined>();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function openEdit(role: JobRole) {
    setEditing(role);
    setName(role.name);
    setFormOpen(true);
  }

  function openNew() {
    setEditing(undefined);
    setName("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setName("");
    setError("");
    setEditing(undefined);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const url = editing ? `/api/job-roles/${editing.id}` : "/api/job-roles";
    const method = editing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    const updated = await res.json();

    if (editing) {
      setRoles(roles.map((r) => (r.id === updated.id ? updated : r)));
    } else {
      setRoles([...roles, updated]);
    }

    closeForm();
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this job role?")) return;

    const res = await fetch(`/api/job-roles/${id}`, { method: "DELETE" });
    if (!res.ok) return;

    setRoles(roles.filter((r) => r.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openNew}>
          + Add Role
        </Button>
      </div>

      <div className="grid gap-3">
        {roles.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No job roles yet.</p>
        ) : (
          roles.map((role) => (
            <div
              key={role.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
            >
              <span className="font-medium">{role.name}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => openEdit(role)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(role.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Job Role" : "Add Job Role"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Role name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Server, Chef, Host"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeForm}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving…" : editing ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
