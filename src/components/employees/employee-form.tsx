"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createEmployee, updateEmployee } from "@/server/employees";

const CATEGORIES = [
  "cutting",
  "designing",
  "embroidery",
  "stone_crystals",
  "hand_work",
  "stitching",
] as const;

interface Props {
  mode: "create" | "edit";
  initial?: {
    id: string;
    fullName: string;
    phone?: string | null;
    email?: string | null;
    categories: unknown;
    isActive: boolean;
  };
}

export function EmployeeForm({ mode, initial }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: initial?.fullName ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    categories: ((initial?.categories as string[]) ?? []) as string[],
    isActive: initial?.isActive ?? true,
  });

  function toggleCategory(key: string) {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(key)
        ? f.categories.filter((c) => c !== key)
        : [...f.categories, key],
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const payload = {
        fullName: form.fullName,
        phone: form.phone,
        email: form.email,
        categories: form.categories as never,
        isActive: form.isActive,
      };
      const res =
        mode === "create"
          ? await createEmployee(payload)
          : await updateEmployee(initial!.id, payload);
      if (res.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          mode === "create" ? (
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Employee
            </Button>
          ) : (
            <Button variant="outline" size="sm">
              Edit
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add Employee" : "Edit Employee"}
          </DialogTitle>
          <DialogDescription>
            An employee can belong to multiple production categories.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label className="text-xs">Full name *</Label>
            <Input
              className="mt-1"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Phone</Label>
              <Input
                className="mt-1"
                value={form.phone ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                className="mt-1"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Production categories</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {CATEGORIES.map((key) => (
                <label
                  key={key}
                  className="flex items-center gap-2 text-sm capitalize text-slate-600"
                >
                  <Checkbox
                    checked={form.categories.includes(key)}
                    onCheckedChange={() => toggleCategory(key)}
                  />
                  {key.replace(/_/g, " ")}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Active</Label>
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
            />
          </div>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
