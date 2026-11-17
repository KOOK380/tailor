"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createCustomer, lookupByMobile } from "@/server/customers";
import { createOrder } from "@/server/orders";
import { OPTIONAL_STAGES, STAGE_LABELS } from "@/db/schema";
import { formatMoney } from "@/lib/currency";

interface EmployeeOption {
  id: string;
  fullName: string;
}

interface CustomerOption {
  id: string;
  fullName: string;
  mobile: string;
}

interface ItemDraft {
  garmentType: string;
  quantity: number;
  fabricDetails: string;
  color: string;
  unitPrice: number;
  notes: string;
  skippedStages: string[];
}

const EMPTY_ITEM: ItemDraft = {
  garmentType: "",
  quantity: 1,
  fabricDetails: "",
  color: "",
  unitPrice: 0,
  notes: "",
  skippedStages: [],
};

const PRIORITY_LABELS: Record<string, string> = {
  normal: "Normal",
  high: "High Priority",
  urgent: "Urgent",
  critical: "Critical",
};

export function OrderWizard({
  employees,
  presetCustomerId,
  presetCustomerName,
  currency = "INR",
}: {
  employees: EmployeeOption[];
  presetCustomerId?: string;
  presetCustomerName?: string;
  currency?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: customer
  const [customer, setCustomer] = useState<CustomerOption | null>(
    presetCustomerId
      ? { id: presetCustomerId, fullName: presetCustomerName ?? "Customer", mobile: "" }
      : null,
  );
  const [mobileSearch, setMobileSearch] = useState("");
  const [searchResults, setSearchResults] = useState<CustomerOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ fullName: "", mobile: "", altMobile: "" });

  // Step 2: items
  const [items, setItems] = useState<ItemDraft[]>([{ ...EMPTY_ITEM }]);

  // Step 3: schedule
  const today = new Date().toISOString().slice(0, 10);
  const [schedule, setSchedule] = useState({
    orderDate: today,
    deliveryDate: "",
    deliveryTime: "17:00",
    priority: "normal",
    assignedEmployeeId: "",
    designInstructions: "",
    notes: "",
  });

  // Advance payment collected with the order (optional).
  const [advance, setAdvance] = useState({
    amount: 0,
    method: "cash",
    reference: "",
  });

  const orderTotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const balanceAfterAdvance = Math.max(0, orderTotal - advance.amount);

  // Deep-link: ?customerId=... preselects step 1.
  useEffect(() => {
    const cid = searchParams.get("customerId");
    if (cid && !customer) {
      setCustomer({ id: cid, fullName: presetCustomerName ?? "Selected customer", mobile: "" });
      setStep(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(query: string) {
    // Only search once the user has typed something — no full contact list.
    if (query.trim() === "") {
      setSearchResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const results = await lookupByMobile(query.trim());
      setSearchResults(
        results.map((c) => ({ id: c.id, fullName: c.fullName, mobile: c.mobile })),
      );
      setSearched(true);
    } catch {
      setSearchResults([]);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  // Instant search: results update as the user types (debounced).
  useEffect(() => {
    const timer = setTimeout(() => {
      void runSearch(mobileSearch);
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileSearch]);

  async function createInlineCustomer() {
    if (!newCustomer.fullName || !newCustomer.mobile) {
      setError("Name and mobile are required for a new customer");
      return;
    }
    setLoading(true);
    const res = await createCustomer({
      fullName: newCustomer.fullName,
      mobile: newCustomer.mobile,
      altMobile: newCustomer.altMobile,
      email: "",
      address: "",
      notes: "",
    });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setCustomer({
      id: res.id!,
      fullName: newCustomer.fullName,
      mobile: newCustomer.mobile,
    });
    setError(null);
    setStep(2);
  }

  function updateItem(idx: number, patch: Partial<ItemDraft>) {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function toggleSkip(idx: number, key: string) {
    setItems((arr) =>
      arr.map((it, i) => {
        if (i !== idx) return it;
        const skipped = it.skippedStages.includes(key)
          ? it.skippedStages.filter((k) => k !== key)
          : [...it.skippedStages, key];
        return { ...it, skippedStages: skipped };
      }),
    );
  }

  async function submit() {
    setError(null);
    if (!customer) {
      setError("Select a customer first");
      setStep(1);
      return;
    }
    if (items.some((i) => !i.garmentType)) {
      setError("Every garment needs a type");
      setStep(2);
      return;
    }
    if (!schedule.deliveryDate) {
      setError("Delivery date is required");
      return;
    }
    if (schedule.deliveryDate < schedule.orderDate) {
      setError("Delivery date cannot be before order date");
      return;
    }
    setLoading(true);
    try {
      const res = await createOrder({
        customerId: customer.id,
        priority: schedule.priority,
        orderDate: schedule.orderDate,
        deliveryDate: schedule.deliveryDate,
        deliveryTime: schedule.deliveryTime,
        assignedEmployeeId: schedule.assignedEmployeeId || "",
        designInstructions: schedule.designInstructions,
        notes: schedule.notes,
        items: items.map((it) => ({
          garmentCategory: "custom",
          garmentType: it.garmentType,
          quantity: it.quantity,
          fabricDetails: it.fabricDetails,
          color: it.color,
          measurements: {},
          measurementId: "",
          unitPrice: it.unitPrice,
          notes: it.notes,
          skippedStages: it.skippedStages,
        })),
        advancePayment:
          advance.amount > 0
            ? {
                amount: advance.amount,
                method: advance.method,
                reference: advance.reference,
              }
            : undefined,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      router.push(`/orders/${res.orderId ?? ""}`);
      router.refresh();
    } catch {
      setError("Failed to create order — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* Stepper */}
      <div className="mb-8 flex items-center gap-2">
        {["Customer", "Garments", "Schedule & Review"].map((label, i) => {
          const n = i + 1;
          const state = n < step ? "done" : n === step ? "current" : "todo";
          return (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  state === "done"
                    ? "bg-blue-600 text-white"
                    : state === "current"
                      ? "bg-blue-100 text-blue-700 ring-2 ring-blue-600"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                {state === "done" ? <Check className="h-4 w-4" /> : n}
              </div>
              <span
                className={`text-sm ${state === "current" ? "font-medium text-slate-900" : "text-slate-500"}`}
              >
                {label}
              </span>
              {i < 2 && <div className="h-px flex-1 bg-slate-200" />}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Step 1 — Customer */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select or add customer</CardTitle>
            <CardDescription>Search by mobile number or register a new customer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {customer ? (
              <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900">{customer.fullName}</p>
                  <p className="text-sm text-slate-500">{customer.mobile}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setCustomer(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Input
                    placeholder="Type name or mobile to search…"
                    value={mobileSearch}
                    onChange={(e) => setMobileSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Start typing to search — e.g. “priya” or 9000010001 (digits
                  work with or without country code / spaces).
                </p>
                {searching && (
                  <p className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching customers…
                  </p>
                )}
                {!searching && searched && mobileSearch.trim() !== "" && searchResults.length === 0 && (
                  <p className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
                    No customers found for “{mobileSearch}”. Check the number or
                    create a new customer below.
                  </p>
                )}
                {searchResults.length > 0 && (
                  <div className="divide-y rounded-lg border">
                    {searchResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50"
                        onClick={() => {
                          setCustomer(c);
                          setSearchResults([]);
                          setSearched(false);
                        }}
                      >
                        <div>
                          <p className="font-medium text-slate-800">{c.fullName}</p>
                          <p className="text-xs text-slate-500">{c.mobile}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </button>
                    ))}
                  </div>
                )}

                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="mb-3 text-sm font-medium text-slate-700">
                    New customer
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Name *</Label>
                      <Input
                        className="mt-1"
                        value={newCustomer.fullName}
                        onChange={(e) =>
                          setNewCustomer((s) => ({ ...s, fullName: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Mobile *</Label>
                      <Input
                        className="mt-1"
                        value={newCustomer.mobile}
                        onChange={(e) =>
                          setNewCustomer((s) => ({ ...s, mobile: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Alt. contact</Label>
                      <Input
                        className="mt-1"
                        value={newCustomer.altMobile}
                        onChange={(e) =>
                          setNewCustomer((s) => ({ ...s, altMobile: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="mt-3"
                    size="sm"
                    onClick={createInlineCustomer}
                    disabled={loading}
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create customer &amp; continue
                  </Button>
                </div>
              </>
            )}

            <div className="flex justify-end">
              <Button disabled={!customer} onClick={() => setStep(2)}>
                Continue
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — Garments */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Garment details</CardTitle>
            <CardDescription>
              Add one or more garments. Unneeded production stages can be skipped per garment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {items.map((item, idx) => (
              <div key={idx} className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">
                    Garment {idx + 1}
                  </p>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setItems((a) => a.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Garment type *</Label>
                    <Input
                      className="mt-1"
                      placeholder="e.g. Designer Blouse"
                      value={item.garmentType}
                      onChange={(e) => updateItem(idx, { garmentType: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      className="mt-1"
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(idx, { quantity: Number(e.target.value) || 1 })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Fabric details</Label>
                    <Input
                      className="mt-1"
                      placeholder="e.g. Banarasi silk"
                      value={item.fabricDetails}
                      onChange={(e) => updateItem(idx, { fabricDetails: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Color</Label>
                    <Input
                      className="mt-1"
                      value={item.color}
                      onChange={(e) => updateItem(idx, { color: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Unit price</Label>
                    <Input
                      className="mt-1"
                      type="number"
                      min={0}
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateItem(idx, { unitPrice: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Input
                      className="mt-1"
                      value={item.notes}
                      onChange={(e) => updateItem(idx, { notes: e.target.value })}
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs font-medium text-slate-500">
                    Skip stages not required for this garment:
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-3">
                    {OPTIONAL_STAGES.map((key) => (
                      <label
                        key={key}
                        className="flex items-center gap-1.5 text-sm text-slate-600"
                      >
                        <Checkbox
                          checked={item.skippedStages.includes(key)}
                          onCheckedChange={() => toggleSkip(idx, key)}
                        />
                        {STAGE_LABELS[key]}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setItems((a) => [...a, { ...EMPTY_ITEM }])}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add another garment
            </Button>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={() => setStep(3)}>
                Continue
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Schedule */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule &amp; review</CardTitle>
            <CardDescription>
              Set the delivery deadline and priority. The system will track days-left
              automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Order date</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={schedule.orderDate}
                  onChange={(e) =>
                    setSchedule((s) => ({ ...s, orderDate: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Delivery date *</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={schedule.deliveryDate}
                  onChange={(e) =>
                    setSchedule((s) => ({ ...s, deliveryDate: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Delivery time</Label>
                <Input
                  className="mt-1"
                  type="time"
                  value={schedule.deliveryTime}
                  onChange={(e) =>
                    setSchedule((s) => ({ ...s, deliveryTime: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Priority</Label>
                <Select
                  value={schedule.priority}
                  onValueChange={(v) =>
                    setSchedule((s) => ({ ...s, priority: v ?? "normal" }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue>
                      {PRIORITY_LABELS[schedule.priority] ?? "Normal"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High Priority</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Assign employee (optional)</Label>
                <Select
                  value={schedule.assignedEmployeeId || "none"}
                  onValueChange={(v) =>
                    setSchedule((s) => ({
                      ...s,
                      assignedEmployeeId: !v || v === "none" ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue>
                      {schedule.assignedEmployeeId
                        ? (employees.find((e) => e.id === schedule.assignedEmployeeId)
                            ?.fullName ?? "Assigned employee")
                        : "No assignment"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No assignment</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Design instructions</Label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  value={schedule.designInstructions}
                  onChange={(e) =>
                    setSchedule((s) => ({ ...s, designInstructions: e.target.value }))
                  }
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Additional notes</Label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  value={schedule.notes}
                  onChange={(e) => setSchedule((s) => ({ ...s, notes: e.target.value }))}
                />
              </div>
            </div>

            {/* Advance payment */}
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-800">
                Advance payment (optional)
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Record any advance the customer pays now — it saves as a payment
                on the order and updates the balance automatically.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Amount received</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={0}
                    placeholder="0"
                    value={advance.amount || ""}
                    onChange={(e) =>
                      setAdvance((a) => ({ ...a, amount: Number(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Payment method</Label>
                  <Select
                    value={advance.method}
                    onValueChange={(v) =>
                      setAdvance((a) => ({ ...a, method: v ?? "cash" }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue>
                        {{ cash: "Cash", upi: "UPI", card: "Card", bank_transfer: "Bank transfer", cheque: "Cheque", other: "Other" }[
                          advance.method
                        ] ?? "Cash"}
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
                  <Label className="text-xs">Reference (optional)</Label>
                  <Input
                    className="mt-1"
                    placeholder="UTR / cheque no."
                    value={advance.reference}
                    onChange={(e) =>
                      setAdvance((a) => ({ ...a, reference: e.target.value }))
                    }
                  />
                </div>
              </div>
              {advance.amount > orderTotal && (
                <p className="mt-2 text-xs text-amber-600">
                  Advance is more than the order total ({formatMoney(orderTotal, currency)}) —
                  the order will show as fully paid.
                </p>
              )}
            </div>

            {/* Review summary */}
            <div className="rounded-lg bg-slate-50 p-4 text-sm">
              <p className="font-medium text-slate-700">Review</p>
              <p className="mt-1 text-slate-600">
                Customer: <strong>{customer?.fullName}</strong>
              </p>
              <p className="text-slate-600">
                Garments:{" "}
                <strong>
                  {items.map((i) => `${i.garmentType} ×${i.quantity}`).join(", ")}
                </strong>
              </p>
              <p className="text-slate-600">
                Delivery:{" "}
                <strong>
                  {schedule.deliveryDate || "—"}
                  {schedule.deliveryTime ? ` at ${schedule.deliveryTime}` : ""}
                </strong>
              </p>
              <div className="mt-2 space-y-0.5 border-t border-slate-200 pt-2">
                <p className="text-slate-600">
                  Order total: <strong>{formatMoney(orderTotal, currency)}</strong>
                </p>
                <p className="text-slate-600">
                  Advance now:{" "}
                  <strong className="text-green-600">
                    {formatMoney(advance.amount, currency)}
                  </strong>
                </p>
                <p className="text-slate-600">
                  Balance: <strong>{formatMoney(balanceAfterAdvance, currency)}</strong>
                </p>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={submit} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Order
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
