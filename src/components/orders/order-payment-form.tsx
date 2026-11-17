"use client";

/** Record a payment (advance/part/full) directly against an order. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { recordOrderPayment } from "@/server/orders";
import { formatMoney } from "@/lib/currency";

export function OrderPaymentForm({
  orderId,
  balanceDue,
  currency = "INR",
}: {
  orderId: string;
  balanceDue: number;
  currency?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(Math.max(0, balanceDue));
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await recordOrderPayment({
        orderId,
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
        render={
          <Button size="sm" className="w-full">
            <Wallet className="mr-1.5 h-4 w-4" />
            Record Payment
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Order Payment</DialogTitle>
          <DialogDescription>
            {balanceDue > 0
              ? `Balance due: ${formatMoney(balanceDue, currency)}`
              : "This order is fully paid."}
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
                  {{ cash: "Cash", upi: "UPI", card: "Card", bank_transfer: "Bank transfer", cheque: "Cheque", other: "Other" }[
                    method
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
            <Label className="text-xs">Reference</Label>
            <Input
              className="mt-1"
              placeholder="UTR / cheque no. (optional)"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <DialogFooter>
            <Button onClick={submit} disabled={busy || amount <= 0}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Payment
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
