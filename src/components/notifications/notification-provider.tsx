"use client";

/**
 * Client-side notification orchestrator (Modules 4.B/D).
 *
 * - Subscribes to the SSE stream for realtime alerts.
 * - Maintains the toast queue shown by NotificationToaster.
 * - Dedupes popups across browser tabs with BroadcastChannel.
 * - Restores unread notifications after login/refresh via the bell count.
 * - Registers the service worker and manages Web Push subscriptions.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { NotificationToaster, type ToastNotification } from "./notification-toaster";
import { NotificationBell } from "./notification-bell";
import { playNotificationSound } from "@/lib/notify-sound";

interface Ctx {
  unread: number;
  refresh: () => void;
  clearToasts: () => void;
}

const NotificationContext = createContext<Ctx>({
  unread: 0,
  refresh: () => {},
  clearToasts: () => {},
});

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [headerEl, setHeaderEl] = useState<HTMLElement | null>(null);
  const seenIds = useRef(new Set<string>());
  const channelRef = useRef<BroadcastChannel | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?filter=unread&limit=1");
      const data = await res.json();
      setUnread(data.unreadCount ?? 0);
    } catch {
      /* offline — keep last count */
    }
  }, []);

  const pushToast = useCallback((n: ToastNotification) => {
    if (seenIds.current.has(n.id)) return; // cross-tab + repeat dedup
    seenIds.current.add(n.id);
    // Announce to other tabs so they don't show the same popup.
    channelRef.current?.postMessage({ type: "shown", id: n.id });
    setToasts((t) => [{ ...n, readAt: n.readAt ?? null }, ...t]);
  }, []);

  /** Hide all visible popups (used by "Mark all read"). */
  const [clearSignal, setClearSignal] = useState(0);
  const clearToasts = useCallback(() => {
    setToasts([]);
    setClearSignal((s) => s + 1); // also closes the critical-alert modal
  }, []);

  // While the bell panel is open the toast stack steps aside — they would
  // overlap the panel and cover the page.
  const [panelOpen, setPanelOpen] = useState(false);

  /* ---- cross-tab coordination ---- */
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel("tailor-notifications");
    channelRef.current = ch;
    ch.onmessage = (e) => {
      if (e.data?.type === "shown") {
        seenIds.current.add(e.data.id);
        // Remove from local queue if present (another tab handled it).
        setToasts((t) => t.filter((x) => x.id !== e.data.id));
      }
      if (e.data?.type === "refresh-count") {
        refresh();
      }
      // "Mark all read" anywhere → hide popups in every tab too.
      if (e.data?.type === "all-read") {
        setToasts([]);
        setClearSignal((s) => s + 1);
        refresh();
      }
    };
    return () => ch.close();
  }, [refresh]);

  /* ---- SSE subscription ---- */
  useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      source = new EventSource("/api/notifications/stream");
      source.addEventListener("notification", (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data) as ToastNotification;
          if (!data.readAt) {
            pushToast(data);
            // Play the alert chime for live notifications (mutable in bell).
            playNotificationSound(data.priority === "critical" ? "critical" : "normal");
          }
          refresh();
        } catch {
          /* parse error — ignore */
        }
      });
      source.onerror = () => {
        // Auto-reconnect with backoff; polling refresh keeps counts fresh.
        source?.close();
        refresh();
        retry = setTimeout(connect, 15000);
      };
    };
    connect();

    // Fallback polling every 45s (covers SSE hiccups).
    const poll = setInterval(refresh, 45000);

    return () => {
      source?.close();
      if (retry) clearTimeout(retry);
      clearInterval(poll);
    };
  }, [pushToast, refresh]);

  /* ---- initial load: restore only CRITICAL unread alerts as popups ----
     Everything else is waiting in the bell (unread persists across reloads);
     popping old toasts on every refresh is noise. New alerts still arrive
     live via SSE as popups. */
  useEffect(() => {
    (async () => {
      await refresh();
      try {
        const res = await fetch("/api/notifications?filter=urgent&limit=30");
        const data = await res.json();
        const criticals = (data.items ?? [])
          .filter(
            (i: { readAt: string | null; priority: string }) =>
              !i.readAt && i.priority === "critical",
          )
          .slice(0, 3);
        for (const item of criticals) {
          pushToast({
            id: item.id,
            type: item.type,
            title: item.title,
            message: item.message,
            priority: item.priority,
            orderId: item.orderId,
            metadata: item.metadata,
            createdAt: item.createdAt,
            readAt: null,
          });
        }
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- mount bell into the app header slot ---- */
  useEffect(() => {
    const el = document.getElementById("header-actions");
    setHeaderEl(el);
  }, []);

  /* ---- toast actions ---- */
  const act = useCallback(
    async (id: string, action: string, snoozeMinutes?: number) => {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id, action, snoozeMinutes }),
      });
      if (action === "dismiss" || action === "snooze" || action === "acknowledge") {
        setToasts((t) => t.filter((x) => x.id !== id));
      }
      if (action === "read") {
        setToasts((t) => t.filter((x) => x.id !== id));
      }
      refresh();
      channelRef.current?.postMessage({ type: "refresh-count" });
    },
    [refresh],
  );

  return (
    <NotificationContext.Provider value={{ unread, refresh, clearToasts }}>
      {children}
      {headerEl &&
        createPortal(
          <div className="flex items-center gap-1">
            <NotificationBell
              unreadCount={unread}
              onChanged={() => {
                refresh();
                channelRef.current?.postMessage({ type: "refresh-count" });
              }}
              onAllRead={() => {
                clearToasts();
                refresh();
                channelRef.current?.postMessage({ type: "all-read" });
              }}
              onOpenChange={setPanelOpen}
            />
          </div>,
          headerEl,
        )}
      <NotificationToaster
        toasts={toasts}
        onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))}
        onRead={(id) => act(id, "read")}
        onSnooze={(id, m) => act(id, "snooze", m)}
        onAcknowledge={(id) => act(id, "acknowledge")}
        clearSignal={clearSignal}
        hidden={panelOpen}
      />
    </NotificationContext.Provider>
  );
}
