"use client";

/**
 * Notification bell + panel (Module 4.C).
 * Bell shows unread count; panel has All/Unread/Urgent/Production/Deadline/
 * Overdue sections with per-item actions and pagination.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Clock,
  ExternalLink,
  Inbox,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SoundToggle } from "./sound-toggle";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface Item {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  orderId: string | null;
  orderNumber: string | null;
  customerName: string | null;
  createdAt: string;
  readAt: string | null;
  snoozedUntil: string | null;
}

const TABS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "urgent", label: "Urgent" },
  { key: "production", label: "Production" },
  { key: "deadline", label: "Deadline" },
  { key: "overdue", label: "Overdue" },
];

function priorityChip(priority: string) {
  switch (priority) {
    case "critical":
      return "bg-red-100 text-red-700";
    case "high":
      return "bg-orange-100 text-orange-700";
    case "medium":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export function NotificationBell({
  unreadCount,
  onChanged,
  onAllRead,
  onOpenChange,
}: {
  unreadCount: number;
  onChanged: () => void;
  onAllRead?: () => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const setPanelOpen = (v: boolean) => {
    setOpen(v);
    onOpenChange?.(v);
  };
  const [tab, setTab] = useState("all");
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 15;

  const load = useCallback(
    async (tabKey: string, pageIdx: number) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/notifications?filter=${tabKey}&limit=${PAGE_SIZE}&offset=${pageIdx * PAGE_SIZE}`,
        );
        const data = await res.json();
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (open) load(tab, page);
  }, [open, tab, page, load]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function action(id: string, act: string, snoozeMinutes?: number) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: id, action: act, snoozeMinutes }),
    });
    await load(tab, page);
    onChanged();
  }

  async function markAll() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    await load(tab, page);
    onChanged();
    // Hide the visible popups as well (read = done looking at).
    onAllRead?.();
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        aria-label={`Notifications (${unreadCount} unread)`}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100",
          open && "bg-slate-100",
        )}
        onClick={() => setPanelOpen(!open)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-slide-down absolute right-0 top-11 z-50 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              <p className="text-xs text-slate-500">
                {unreadCount} unread
                {total > 0 ? ` · ${total} total` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <SoundToggle />
              <Button size="xs" variant="ghost" onClick={markAll}>
                <CheckCheck className="mr-1 h-3.5 w-3.5" />
                Mark all read
              </Button>
            </div>
          </div>

          <Tabs value={tab} onValueChange={(v) => { setTab(v ?? "all"); setPage(0); }}>
            <div className="border-b border-slate-100 px-2">
              <TabsList className="h-9 w-full justify-start overflow-x-auto bg-transparent">
                {TABS.map((t) => (
                  <TabsTrigger key={t.key} value={t.key} className="text-xs">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {TABS.map((t) => (
              <TabsContent key={t.key} value={t.key} className="m-0">
                {/* Plain scroll container: clips + scrolls internally so
                    list items can never paint outside the panel or overlap
                    the pagination bar. */}
                <div className="max-h-[420px] overflow-y-auto">
                  {loading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                  ) : items.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                      <Inbox className="h-8 w-8" />
                      <p className="text-sm">No notifications here</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {items.map((n) => (
                        <div
                          key={n.id}
                          className={cn(
                            "px-4 py-3 transition-colors hover:bg-slate-50",
                            !n.readAt && "bg-blue-50/40",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {!n.readAt && (
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                                )}
                                <p className="truncate text-sm font-medium text-slate-900">
                                  {n.title}
                                </p>
                                <span
                                  className={cn(
                                    "rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize",
                                    priorityChip(n.priority),
                                  )}
                                >
                                  {n.priority}
                                </span>
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-600">
                                {n.message}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                                {n.orderNumber && (
                                  <span className="font-medium text-slate-500">
                                    #{n.orderNumber}
                                  </span>
                                )}
                                {n.customerName && <span>{n.customerName}</span>}
                                <span>
                                  {new Date(n.createdAt).toLocaleString()}
                                </span>
                                {n.snoozedUntil && (
                                  <span className="inline-flex items-center gap-0.5 text-amber-600">
                                    <Clock className="h-3 w-3" />
                                    snoozed
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {n.orderId && (
                              <Button
                                size="xs"
                                variant="ghost"
                                className="h-6 text-[11px]"
                                onClick={() => {
                                  action(n.id, "read");
                                  setPanelOpen(false);
                                  router.push(`/orders/${n.orderId}`);
                                }}
                              >
                                <ExternalLink className="mr-1 h-3 w-3" />
                                Open Order
                              </Button>
                            )}
                            {n.readAt ? (
                              <Button
                                size="xs"
                                variant="ghost"
                                className="h-6 text-[11px]"
                                onClick={() => action(n.id, "unread")}
                              >
                                Mark unread
                              </Button>
                            ) : (
                              <Button
                                size="xs"
                                variant="ghost"
                                className="h-6 text-[11px]"
                                onClick={() => action(n.id, "read")}
                              >
                                Mark read
                              </Button>
                            )}
                            <Button
                              size="xs"
                              variant="ghost"
                              className="h-6 text-[11px]"
                              onClick={() => action(n.id, "snooze", 60)}
                            >
                              Snooze
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              className="h-6 text-[11px] text-slate-400"
                              onClick={() => action(n.id, "dismiss")}
                            >
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Pagination */}
                {total > PAGE_SIZE && (
                  <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2">
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-xs text-slate-500">
                      Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}
                    </span>
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={(page + 1) * PAGE_SIZE >= total}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}
    </div>
  );
}

export { Badge };
