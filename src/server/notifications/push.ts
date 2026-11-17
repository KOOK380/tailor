/**
 * Web Push delivery (Module 4.D) using the web-push library with VAPID.
 *
 * When VAPID keys are not configured (env missing), push delivery is skipped
 * gracefully and logged in notification_delivery_attempts as "skipped" —
 * in-app notifications continue to work regardless (spec: "The application
 * should continue showing in-app notifications even when browser push is
 * unavailable").
 */
import webpush from "web-push";
import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  pushSubscriptions,
  notificationDeliveryAttempts,
  notifications,
} from "@/db/schema";

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

function ensureVapid() {
  if (!isPushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  return true;
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

export interface PushPayload {
  title: string;
  body: string;
  priority: string;
  notificationId: string;
  orderId?: string | null;
  tag?: string;
}

/**
 * Send push to all registered devices of a user. Records one delivery-attempt
 * row per notification (channel=push) with retry count and error details.
 */
export async function sendPushToUser(
  businessId: string,
  userId: string,
  payload: PushPayload,
): Promise<"sent" | "skipped" | "failed"> {
  const db = getDb();

  // Record/update delivery attempt row.
  const [attempt] = await db
    .insert(notificationDeliveryAttempts)
    .values({
      businessId,
      notificationId: payload.notificationId,
      channel: "push",
      deliveryStatus: "pending",
      attemptCount: 1,
      lastAttemptAt: new Date(),
    })
    .returning();

  const mark = async (status: "sent" | "skipped" | "failed", error?: string) => {
    await db
      .update(notificationDeliveryAttempts)
      .set({ deliveryStatus: status, errorDetails: error ?? null, updatedAt: new Date() })
      .where(eq(notificationDeliveryAttempts.id, attempt.id));
  };

  if (!ensureVapid()) {
    await mark("skipped", "VAPID keys not configured");
    return "skipped";
  }

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.businessId, businessId),
      ),
    );
  if (subs.length === 0) {
    await mark("skipped", "No registered devices");
    return "skipped";
  }

  let sent = 0;
  const errors: string[] = [];
  for (const sub of subs) {
    const details = sub.encryptedSubscriptionDetails as {
      endpoint?: string;
      keys?: { p256dh: string; auth: string };
      expirationTime?: number | null;
    };
    try {
      const res = await webpush.sendNotification(
        {
          endpoint: details.endpoint ?? sub.endpoint,
          keys: {
            p256dh: details.keys?.p256dh ?? "",
            auth: details.keys?.auth ?? "",
          },
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          priority: payload.priority,
          data: {
            notificationId: payload.notificationId,
            orderId: payload.orderId ?? null,
            url: payload.orderId ? `/orders/${payload.orderId}` : "/notifications",
          },
          tag: payload.tag ?? payload.notificationId,
        }),
      );
      if (res.statusCode === 201 || res.statusCode === 200) {
        sent += 1;
        await db
          .update(pushSubscriptions)
          .set({ lastUsedAt: new Date() })
          .where(eq(pushSubscriptions.id, sub.id));
      }
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      errors.push(e.message ?? "send failed");
      // Expired subscriptions must be cleaned up (Module 4.D).
      if (e.statusCode === 404 || e.statusCode === 410) {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.id, sub.id));
      }
    }
  }

  if (sent > 0) {
    await mark("sent");
    return "sent";
  }
  await mark("failed", errors.slice(0, 2).join("; ") || "all sends failed");
  return "failed";
}

/** Fan out push for freshly created notifications (called after bulk insert). */
export async function dispatchPushForNotifications(
  businessId: string,
  notificationIds: string[],
): Promise<void> {
  if (notificationIds.length === 0) return;
  const db = getDb();
  const rows = await db
    .select()
    .from(notifications)
    .where(inArray(notifications.id, notificationIds));
  for (const n of rows) {
    if (!n.recipientUserId) continue;
    // Only push high-priority and above (avoid notification spam).
    if (n.priority === "low") continue;
    await sendPushToUser(businessId, n.recipientUserId, {
      title: n.title,
      body: n.message,
      priority: n.priority,
      notificationId: n.id,
      orderId: n.orderId,
    });
  }
}
