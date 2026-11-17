"use client";

/**
 * Push subscription management UI (Module 4.D):
 * permission request, service worker registration, device registration,
 * unsubscribe, and safe handling of denied permission.
 */
import { useEffect, useState } from "react";
import { Bell, BellOff, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

function getDeviceId(): string {
  const key = "tailor_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function PushSettings() {
  const [status, setStatus] = useState<
    "loading" | "unsupported" | "default" | "granted" | "denied" | "enabled"
  >("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [serverReady, setServerReady] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      // Server-side push readiness (VAPID keys configured?).
      try {
        const res = await fetch("/api/push/vapid-public-key");
        const data = await res.json();
        setServerReady(Boolean(data.configured));
      } catch {
        setServerReady(false);
      }

      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        setStatus("unsupported");
        return;
      }
      const permission = Notification.permission;
      if (permission === "denied") {
        setStatus("denied");
        return;
      }
      if (permission === "granted") {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        setStatus(sub ? "enabled" : "granted");
      } else {
        setStatus("default");
      }
    })();
  }, []);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      // 1. Permission
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setStatus("denied");
        return;
      }
      if (permission !== "granted") {
        setStatus("default");
        return;
      }

      // 2. Service worker
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // 3. VAPID key
      const keyRes = await fetch("/api/push/vapid-public-key");
      const { publicKey, configured } = await keyRes.json();
      if (!configured || !publicKey) {
        setStatus("granted");
        setMsg({
          kind: "err",
          text: "Push server is not configured yet (VAPID keys missing).",
        });
        return;
      }

      // 4. Subscribe
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      // 5. Register with server
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceIdentifier: getDeviceId(),
          subscription: sub.toJSON(),
          userAgent: navigator.userAgent,
        }),
      });
      setStatus("enabled");
      setMsg({ kind: "ok", text: "Push enabled — this device will receive alerts." });
    } catch (err) {
      setMsg({
        kind: "err",
        text:
          "Could not enable push notifications: " +
          (err instanceof Error ? err.message : "unknown error"),
      });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch(
          `/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`,
          { method: "DELETE" },
        );
        await sub.unsubscribe();
      }
      setStatus(Notification.permission === "granted" ? "granted" : "default");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {serverReady !== null && (
        <p
          className={cn(
            "rounded-md px-3 py-1.5 text-[11px]",
            serverReady
              ? "bg-green-50 text-green-700"
              : "bg-slate-50 text-slate-500",
          )}
        >
          {serverReady
            ? "Push server ready — delivery is active once you enable below."
            : "Push server not configured (missing VAPID keys in .env)."}
        </p>
      )}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
        <div className="flex items-center gap-2">
          {status === "enabled" ? (
            <Bell className="h-4 w-4 text-green-600" />
          ) : status === "denied" ? (
            <BellOff className="h-4 w-4 text-slate-400" />
          ) : (
            <Bell className="h-4 w-4 text-slate-500" />
          )}
          <div>
            <p className="text-sm font-medium text-slate-800">
              {status === "enabled"
                ? "Push enabled on this device"
                : status === "denied"
                  ? "Permission denied"
                  : status === "unsupported"
                    ? "Not supported in this browser"
                    : "Enable push on this device"}
            </p>
            <p className="text-xs text-slate-500">
              {status === "granted"
                ? "Permission granted — register this device below."
                : status === "denied"
                  ? "Enable notifications in your browser site settings to continue."
                  : "System notifications for urgent alerts."}
            </p>
          </div>
        </div>
        <Switch
          checked={status === "enabled"}
          disabled={
            busy ||
            status === "denied" ||
            status === "unsupported" ||
            status === "loading"
          }
          onCheckedChange={(v) => (v ? enable() : disable())}
        />
      </div>

      {busy && (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Working…
        </p>
      )}
      {msg && (
        <p
          className={cn(
            "flex items-start gap-2 rounded-md px-3 py-2 text-xs",
            msg.kind === "ok"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700",
          )}
        >
          {msg.kind === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          {msg.text}
        </p>
      )}
      {status === "denied" && (
        <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Notifications are blocked for this site. Open your browser&apos;s
          site settings, allow notifications, then reload this page. In-app
          alerts keep working meanwhile.
        </p>
      )}
      {(status === "granted" || status === "enabled") && (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={enable}
          disabled={busy || status === "enabled"}
        >
          Register this device
        </Button>
      )}
    </div>
  );
}
