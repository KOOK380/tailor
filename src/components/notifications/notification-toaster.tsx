"use client";

/**
 * Popup notification system (Module 4.B).
 *
 * - Max 3 stacked toast notifications; further ones queue.
 * - Blue accent = informational, orange = warning, red = critical.
 * - Critical alerts open a prominent modal requiring acknowledgment
 *   (non-destructive — never alters production state).
 * - Closing a toast does NOT mark it read; explicit buttons do.
 * - Snooze hides a reminder for the chosen duration.
 * - The stack auto-hides while the bell panel or the critical modal is open,
 *   so notifications never overlap each other or cover the page.
 */
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  X,
  Clock,
  AlertTriangle,
  Info,
  CheckCircle2,
  ExternalLink,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ToastNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  orderId: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
}

const MAX_VISIBLE = 3;

function accentFor(priority: string, type: string) {
  if (priority === "critical" || type === "due_today" || type === "overdue")
    return { border: "border-red-300", icon: "text-red-600", bg: "bg-red-50", Icon: AlertTriangle };
  if (priority === "high" || type === "warning" || type === "urgent")
    return { border: "border-orange-300", icon: "text-orange-600", bg: "bg-orange-50", Icon: AlertTriangle };
  return { border: "border-blue-200", icon: "text-blue-600", bg: "bg-blue-50", Icon: Info };
}

export function NotificationToaster({
  toasts,
  onDismiss,
  onRead,
  onSnooze,
  onAcknowledge,
  clearSignal = 0,
  hidden = false,
}: {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
  onRead: (id: string) => void;
  onSnooze: (id: string, minutes: number) => void;
  onAcknowledge: (id: string) => void;
  /** Incrementing this closes any open critical modal (e.g. "Mark all read"). */
  clearSignal?: number;
  /** True while the bell panel is open — the stack steps aside. */
  hidden?: boolean;
}) {
  const router = useRouter();
  const [critical, setCritical] = useState<ToastNotification | null>(null);
  const shownIds = useRef(new Set<string>());

  // "Mark all read" (clearSignal) also closes the critical alert modal.
  useEffect(() => {
    if (clearSignal > 0) setCritical(null);
  }, [clearSignal]);

  // Critical alerts get the modal treatment (first one unacknowledged).
  useEffect(() => {
    const firstCritical = toasts.find(
      (t) => t.priority === "critical" && !shownIds.current.has(t.id),
    );
    if (firstCritical) {
      shownIds.current.add(firstCritical.id);
      setCritical(firstCritical);
    }
  }, [toasts]);

  // Non-critical toasts fade from view after 25s (they stay unread in the
  // bell — disappearing is not "marking as read").
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const t of toasts) {
      if (t.priority !== "critical") {
        timers.push(setTimeout(() => onDismiss(t.id), 25000));
      }
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toasts]);

  const visible = toasts.slice(0, MAX_VISIBLE);
  const queued = toasts.length - visible.length;

  // The stack steps aside when the bell panel is open or the critical modal
  // is showing — no more overlapping notification surfaces.
  const stackVisible = !hidden && !critical;

  return (
    <>
      {stackVisible && (
        <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-[55] flex flex-col items-end gap-1.5 sm:left-auto sm:w-[340px]">
          {visible.map((t) => {
            const accent = accentFor(t.priority, t.type);
            return (
              <div
                key={t.id}
                className={cn(
                  "toast-enter pointer-events-auto w-full rounded-xl border bg-white p-2.5 shadow-lg",
                  accent.border,
                )}
              >
                <div className="flex items-start gap-2">
                  <div
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      accent.bg,
                    )}
                  >
                    <accent.Icon className={cn("h-3.5 w-3.5", accent.icon)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-semibold leading-tight text-slate-900">
                        {t.title}
                      </p>
                      <button
                        aria-label="Close notification (keeps it unread)"
                        className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        onClick={() => onDismiss(t.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-600">
                      {t.message}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      {t.orderId && (
                        <Button
                          size="xs"
                          variant="outline"
                          className="h-6"
                          onClick={() => {
                            onRead(t.id);
                            router.push(`/orders/${t.orderId}`);
                          }}
                        >
                          <ExternalLink className="mr-0.5 h-2.5 w-2.5" />
                          View
                        </Button>
                      )}
                      <Button
                        size="xs"
                        variant="ghost"
                        className="h-6 text-[11px]"
                        onClick={() => onRead(t.id)}
                      >
                        <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" />
                        Read
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        className="h-6 text-[11px]"
                        onClick={() => onSnooze(t.id, 60)}
                      >
                        <Clock className="mr-0.5 h-2.5 w-2.5" />
                        Later
                      </Button>
                      {t.priority === "critical" && (
                        <Button
                          size="xs"
                          variant="ghost"
                          className="h-6 text-[11px]"
                          onClick={() => onAcknowledge(t.id)}
                        >
                          <EyeOff className="mr-0.5 h-2.5 w-2.5" />
                          Ack
                        </Button>
                      )}
                      <span className="ml-auto text-[10px] text-slate-400">
                        {new Date(t.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {queued > 0 && (
            <div className="pointer-events-auto rounded-full bg-slate-800 px-3 py-1 text-[11px] font-medium text-white shadow">
              +{queued} more queued
            </div>
          )}
        </div>
      )}

      {/* Critical alert modal (requires explicit acknowledgment).
          Conditionally rendered so closing UNMOUNTS it — the Base UI
          controlled `open` prop alone doesn't close reliably in this build. */}
      {critical && (
        <Dialog open onOpenChange={(open) => !open && setCritical(null)}>
          <DialogContent className="border-red-200 sm:max-w-md">
            <DialogHeader>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <Bell className="h-6 w-6 text-red-600" />
              </div>
              <DialogTitle className="text-center text-red-700">
                {critical.title}
              </DialogTitle>
              <DialogDescription className="text-center">
                {critical.message}
              </DialogDescription>
            </DialogHeader>
            {critical.orderId && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                <p>
                  Order:{" "}
                  <button
                    className="font-medium text-blue-600 hover:underline"
                    onClick={() => {
                      onRead(critical.id);
                      setCritical(null);
                      router.push(`/orders/${critical.orderId}`);
                    }}
                  >
                    View order details
                  </button>
                </p>
              </div>
            )}
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => {
                  if (critical) onSnooze(critical.id, 120);
                  setCritical(null);
                }}
              >
                <Clock className="mr-1.5 h-4 w-4" />
                Snooze 2 Hours
              </Button>
              <Button
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={() => {
                  if (critical) {
                    onAcknowledge(critical.id);
                    onRead(critical.id);
                  }
                  setCritical(null);
                }}
              >
                Acknowledge
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
