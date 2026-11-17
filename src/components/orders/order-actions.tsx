"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CalendarClock, CheckCircle2, XCircle } from "lucide-react";
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
  updateOrderDelivery,
  updateOrderStatus,
} from "@/server/orders";
import type { OrderStatus } from "@/db/schema";

export function OrderActions({
  orderId,
  status,
  deliveryDate,
  deliveryTime,
  canManage,
}: {
  orderId: string;
  status: OrderStatus;
  deliveryDate: string;
  deliveryTime: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(deliveryDate);
  const [time, setTime] = useState(deliveryTime ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) return null;
  const closed = status === "delivered" || status === "cancelled";

  async function saveDelivery() {
    setError(null);
    setBusy(true);
    try {
      const res = await updateOrderDelivery(orderId, date, time);
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

  async function setStatus(next: OrderStatus) {
    setBusy(true);
    try {
      await updateOrderStatus(orderId, next);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {!closed && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button variant="outline" size="sm">
                <CalendarClock className="mr-1.5 h-4 w-4" />
                Reschedule
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change delivery date</DialogTitle>
              <DialogDescription>
                Days-left countdown and future reminders will be recalculated.
                Notification history is preserved.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Delivery date</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Delivery time</Label>
                <Input
                  className="mt-1"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button onClick={saveDelivery} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {status === "finished" && (
        <Button size="sm" onClick={() => setStatus("ready_for_delivery")} disabled={busy}>
          <CheckCircle2 className="mr-1.5 h-4 w-4" />
          Ready for Delivery
        </Button>
      )}
      {(status === "ready_for_delivery" || status === "finished") && (
        <Button size="sm" onClick={() => setStatus("delivered")} disabled={busy}>
          <CheckCircle2 className="mr-1.5 h-4 w-4" />
          Mark Delivered
        </Button>
      )}
      {!closed && (
        <Button
          size="sm"
          variant="ghost"
          className="text-red-600"
          onClick={() => setStatus("cancelled")}
          disabled={busy}
        >
          <XCircle className="mr-1.5 h-4 w-4" />
          Cancel Order
        </Button>
      )}
    </div>
  );
}
