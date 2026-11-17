"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, FileText } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createInvoice, recordPayment } from "@/server/billing";
import { formatMoney, currencySymbol } from "@/lib/currency";

interface CustomerOption {
  id: string;
  fullName: string;
}

interface LineDraft {
  description: string;
  quantity: number;
  unitPrice: number;
}

export function InvoiceForm({
  customers,
  preset,
  currency = "INR",
}: {
  customers: CustomerOption[];
  preset?: {
    customerId: string;
    orderId: string;
    items: LineDraft[];
  } | null;
  currency?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const [customerId, setCustomerId] = useState(preset?.customerId ?? "");
  const [orderId] = useState(preset?.orderId ?? "");
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<LineDraft[]>(
    preset?.items?.length ? preset.items : [{ description: "", quantity: 1, unitPrice: 0 }],
  );
  const [discountType, setDiscountType] = useState<"percent" | "flat">("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [additionalCharges, setAdditionalCharges] = useState(0);
  const [additionalChargesLabel, setAdditionalChargesLabel] = useState("");
  const [advance, setAdvance] = useState(0);
  const [notes, setNotes] = useState("");

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discountAmount =
    discountType === "percent" ? (subtotal * discountValue) / 100 : Math.min(discountValue, subtotal);
  const taxable = subtotal - discountAmount + additionalCharges;
  const taxRate = 18; // display hint; server uses business settings
  const estTotal = taxable + (taxable * taxRate) / 100;

  function updateLine(idx: number, patch: Partial<LineDraft>) {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  async function submit() {
    setError(null);
    if (!customerId) {
      setError("Select a customer");
      return;
    }
    if (items.some((i) => !i.description)) {
      setError("Every line needs a description");
      return;
    }
    setBusy(true);
    try {
      const res = await createInvoice({
        orderId: orderId || undefined,
        customerId,
        issueDate,
        dueDate: dueDate || undefined,
        items,
        discountType,
        discountValue,
        additionalCharges,
        additionalChargesLabel,
        notes,
        advanceAmount: advance,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.push(`/billing/${res.invoiceId}`);
      router.refresh();
    } catch {
      setError("Failed to create invoice");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <FileText className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>
            Automatic invoice with configurable tax. Tax rate comes from
            business settings.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Customer *</Label>
              <Select value={customerId} onValueChange={(v) => setCustomerId(v ?? "")}>
                <SelectTrigger className="mt-1">
                  <SelectValue>
                    {customerId
                      ? (customers.find((c) => c.id === customerId)?.fullName ??
                        "Selected customer")
                      : "Select customer"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Issue date</Label>
              <Input
                className="mt-1"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Due date</Label>
              <Input
                className="mt-1"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Line items</p>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Description (e.g. Designer Blouse)"
                      value={it.description}
                      onChange={(e) => updateLine(idx, { description: e.target.value })}
                    />
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) =>
                        updateLine(idx, { quantity: Number(e.target.value) || 1 })
                      }
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      min={0}
                      placeholder={`Unit ${currencySymbol(currency)}`}
                      value={it.unitPrice}
                      onChange={(e) =>
                        updateLine(idx, { unitPrice: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <span className="w-24 pb-2 text-right text-sm text-slate-600">
                    {formatMoney(it.quantity * it.unitPrice, currency)}
                  </span>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setItems((a) => a.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() =>
                setItems((a) => [...a, { description: "", quantity: 1, unitPrice: 0 }])
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add line
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Discount type</Label>
                <Select
                  value={discountType}
                  onValueChange={(v) => setDiscountType((v as "percent" | "flat") ?? "percent")}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue>
                      {discountType === "percent" ? "Percent %" : "Flat amount"}
                    </SelectValue>
                  </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent %</SelectItem>
                  <SelectItem value="flat">Flat amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Discount value</Label>
              <Input
                className="mt-1"
                type="number"
                min={0}
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">Additional charges</Label>
              <Input
                className="mt-1"
                type="number"
                min={0}
                value={additionalCharges}
                onChange={(e) => setAdditionalCharges(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">Advance received</Label>
              <Input
                className="mt-1"
                type="number"
                min={0}
                value={advance}
                onChange={(e) => setAdvance(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Additional charges label</Label>
            <Input
              className="mt-1"
              placeholder="e.g. Express delivery"
              value={additionalChargesLabel}
              onChange={(e) => setAdditionalChargesLabel(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea
              className="mt-1"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatMoney(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Discount</span>
              <span>- {formatMoney(discountAmount, currency)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tax (from business settings)</span>
              <span>calculated on save</span>
            </div>
            <div className="mt-1 flex justify-between font-semibold text-slate-900">
              <span>Estimated total (incl. {taxRate}% tax)</span>
              <span>{formatMoney(Math.round(estTotal), currency)}</span>
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <DialogFooter>
            <Button onClick={submit} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Invoice
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PaymentForm({
  invoiceId,
  balanceDue,
  currency = "INR",
}: {
  invoiceId: string;
  balanceDue: number;
  currency?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(balanceDue);
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await recordPayment({
        invoiceId,
        amount,
        method,
        reference,
      });
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
        render={<Button size="sm">Record Payment</Button>}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Balance due: {formatMoney(balanceDue, currency)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Amount</Label>
            <Input
              className="mt-1"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label className="text-xs">Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v ?? "cash")}>
              <SelectTrigger className="mt-1">
                <SelectValue>
                  {{ cash: "Cash", upi: "UPI", card: "Card", bank_transfer: "Bank transfer", cheque: "Cheque", other: "Other" }[method] ?? "Cash"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Reference</Label>
            <Input
              className="mt-1"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="UTR / cheque no."
            />
          </div>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <DialogFooter>
            <Button onClick={submit} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Payment
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
