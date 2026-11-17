"use client";

/**
 * Full notification center page (Module 4.C) — history, filters,
 * pagination, per-item actions and push settings entry.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Clock,
  ExternalLink,
  Inbox,
  Loader2,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { PushSettings } from "@/components/notifications/push-settings";
import { PreferencesCard } from "@/components/notifications/preferences-card";

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
  acknowledgedAt: string | null;
  dismissedAt: string | null;
  snoozedUntil: string | null;
}

const TABS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "urgent", label: "Urgent" },
  { key: "production", label: "Production Updates" },
  { key: "deadline", label: "Deadline Alerts" },
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

export default function NotificationsPage() {
  const router = useRouter();
  const [tab, setTab] = useState("all");
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const load = useCallback(async (tabKey: string, pageIdx: number) => {
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
  }, []);

  useEffect(() => {
    load(tab, page);
  }, [tab, page, load]);

  async function action(id: string, act: string, snoozeMinutes?: number) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: id, action: act, snoozeMinutes }),
    });
    load(tab, page);
  }

  async function markAll() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    // Hide visible popups app-wide (provider + other tabs listen for this).
    try {
      new BroadcastChannel("tailor-notifications").postMessage({ type: "all-read" });
    } catch {
      /* BroadcastChannel unsupported — popups clear on next refresh */
    }
    load(tab, page);
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} notification{total === 1 ? "" : "s"} in this view
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={markAll}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all as read
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white">
            <Tabs
              value={tab}
              onValueChange={(v) => {
                setTab(v ?? "all");
                setPage(0);
              }}
            >
              <div className="border-b border-slate-100 px-3">
                <TabsList className="h-11 w-full justify-start overflow-x-auto bg-transparent">
                  {TABS.map((t) => (
                    <TabsTrigger key={t.key} value={t.key} className="text-xs">
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              {TABS.map((t) => (
                <TabsContent key={t.key} value={t.key} className="m-0">
                  {loading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                  ) : items.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-16 text-slate-400">
                      <Inbox className="h-10 w-10" />
                      <p className="text-sm">No notifications in this section</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {items.map((n) => (
                        <div
                          key={n.id}
                          className={cn(
                            "px-5 py-4 transition-colors hover:bg-slate-50",
                            !n.readAt && "bg-blue-50/40",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                                n.priority === "critical"
                                  ? "bg-red-50"
                                  : n.priority === "high"
                                    ? "bg-orange-50"
                                    : "bg-blue-50",
                              )}
                            >
                              <Bell
                                className={cn(
                                  "h-4 w-4",
                                  n.priority === "critical"
                                    ? "text-red-600"
                                    : n.priority === "high"
                                      ? "text-orange-600"
                                      : "text-blue-600",
                                )}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {!n.readAt && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                                )}
                                <p className="text-sm font-medium text-slate-900">
                                  {n.title}
                                </p>
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                                    priorityChip(n.priority),
                                  )}
                                >
                                  {n.priority}
                                </span>
                                {n.acknowledgedAt && (
                                  <span className="text-[10px] text-slate-400">
                                    acknowledged
                                  </span>
                                )}
                                {n.snoozedUntil && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600">
                                    <Clock className="h-3 w-3" />
                                    snoozed until{" "}
                                    {new Date(n.snoozedUntil).toLocaleTimeString()}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                                {n.message}
                              </p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                {n.orderNumber && (
                                  <span className="font-medium text-slate-500">
                                    #{n.orderNumber}
                                  </span>
                                )}
                                {n.customerName && <span>{n.customerName}</span>}
                                <span>
                                  {new Date(n.createdAt).toLocaleString()}
                                </span>
                                <span className="capitalize">
                                  {n.type.replace(/_/g, " ")}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {n.orderId && (
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    onClick={() => {
                                      action(n.id, "read");
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
                                    onClick={() => action(n.id, "unread")}
                                  >
                                    Mark as unread
                                  </Button>
                                ) : (
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    onClick={() => action(n.id, "read")}
                                  >
                                    Mark as read
                                  </Button>
                                )}
                                {n.priority === "critical" && !n.acknowledgedAt && (
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    onClick={() => action(n.id, "acknowledge")}
                                  >
                                    Acknowledge
                                  </Button>
                                )}
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => action(n.id, "snooze", 60)}
                                >
                                  <Clock className="mr-1 h-3 w-3" />
                                  Snooze 1h
                                </Button>
                                {!n.dismissedAt && (
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    className="text-slate-400"
                                    onClick={() => action(n.id, "dismiss")}
                                  >
                                    Dismiss from active view
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {total > PAGE_SIZE && (
                    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={page === 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-slate-500">
                        Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}
                      </span>
                      <Button
                        size="sm"
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
        </div>

        {/* Sidebar: browser push settings */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">
                Browser Push Notifications
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Receive system-level alerts for urgent deadlines even when this
              tab is in the background.
            </p>
            <div className="mt-4">
              <PushSettings />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">
                Notification Preferences
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Choose which categories you receive and on which channels.
            </p>
            <div className="mt-4">
              <PreferencesCard />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
