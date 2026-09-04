"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getTimezoneOptions, type Branch } from "@scheduler/types";

const TIMEZONE_OPTIONS = getTimezoneOptions();

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  branch?: Branch;
};

export function BranchForm({ open, onOpenChange, branch }: Props) {
  const router = useRouter();
  const isEdit = !!branch;

  const [name, setName] = useState(branch?.name ?? "");
  const [slug, setSlug] = useState(branch?.slug ?? "");
  const [address, setAddress] = useState(branch?.address ?? "");
  const [timezone, setTimezone] = useState(branch?.timezone ?? "America/New_York");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tzOpen, setTzOpen] = useState(false);
  const [tzSearch, setTzSearch] = useState("");

  useEffect(() => {
    if (open) {
      if (branch) {
        setName(branch.name);
        setSlug(branch.slug);
        setAddress(branch.address ?? "");
        setTimezone(branch.timezone);
      } else {
        setName("");
        setSlug("");
        setAddress("");
        setTimezone("America/New_York");
      }
      setError("");
      setTzSearch("");
    }
  }, [open, branch]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload = { name, slug: slug || undefined, address: address || undefined, timezone };
    const url = isEdit ? `/api/branches/${branch.id}` : "/api/branches";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    setLoading(false);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Branch" : "Add Branch"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Slug (auto-generated if blank)</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="e.g. downtown"
            />
          </div>
          <div className="space-y-1">
            <Label>Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" />
          </div>
          <div className="space-y-1">
            <Label>Timezone</Label>
            <Popover open={tzOpen} onOpenChange={setTzOpen}>
              <PopoverTrigger
                type="button"
                className="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
              >
                {TIMEZONE_OPTIONS.find((tz) => tz.value === timezone)?.label ?? timezone}
              </PopoverTrigger>
              <PopoverContent align="start" className="w-(--anchor-width) p-0">
                <Input
                  autoFocus
                  value={tzSearch}
                  onChange={(e) => setTzSearch(e.target.value)}
                  placeholder="Search timezones…"
                  className="m-2 w-[calc(100%-1rem)]"
                />
                <div className="max-h-64 overflow-y-auto px-1 pb-1">
                  {TIMEZONE_OPTIONS.filter((tz) =>
                    tz.label.toLowerCase().includes(tzSearch.trim().toLowerCase())
                  )
                    .slice(0, 100)
                    .map((tz) => (
                      <button
                        type="button"
                        key={tz.value}
                        onClick={() => {
                          setTimezone(tz.value);
                          setTzOpen(false);
                        }}
                        className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                      >
                        {tz.label}
                      </button>
                    ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving…" : isEdit ? "Save" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
