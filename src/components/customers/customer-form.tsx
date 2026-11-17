"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createCustomer, updateCustomer } from "@/server/customers";

interface Props {
  mode: "create" | "edit";
  initial?: {
    id: string;
    fullName: string;
    mobile: string;
    altMobile?: string | null;
    email?: string | null;
    address?: string | null;
    trn?: string | null;
    notes?: string | null;
  };
}

export function CustomerForm({ mode, initial }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: initial?.fullName ?? "",
    mobile: initial?.mobile ?? "",
    altMobile: initial?.altMobile ?? "",
    email: initial?.email ?? "",
    address: initial?.address ?? "",
    trn: initial?.trn ?? "",
    notes: initial?.notes ?? "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result =
        mode === "create"
          ? await createCustomer(form)
          : await updateCustomer(initial!.id, form);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Something went wrong — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          mode === "create" ? (
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          ) : (
            <Button variant="outline">Edit</Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add Customer" : "Edit Customer"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Register a new customer with contact details."
              : "Update customer information."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name *</Label>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile *</Label>
              <Input
                id="mobile"
                value={form.mobile}
                onChange={(e) => set("mobile", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="altMobile">Alt. contact</Label>
              <Input
                id="altMobile"
                value={form.altMobile ?? ""}
                onChange={(e) => set("altMobile", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email ?? ""}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="trn">TRN (VAT registration no.)</Label>
              <Input
                id="trn"
                placeholder="e.g. 100000000000003"
                value={form.trn ?? ""}
                onChange={(e) => set("trn", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                rows={2}
                value={form.address ?? ""}
                onChange={(e) => set("address", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Special instructions</Label>
            <Textarea
              id="notes"
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Add Customer" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
