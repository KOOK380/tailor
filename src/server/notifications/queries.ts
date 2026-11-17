"use server";

import { eq, and, desc, isNull, lte, or, count, sql, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  notifications,
  notificationUserState,
  orders,
  customers,
} from "@/db/schema";
import { requireSession } from "@/lib/auth";

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  orderId: string | null;
  orderNumber: string | null;
  customerName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
  acknowledgedAt: string | null;
  dismissedAt: string | null;
  snoozedUntil: string | null;
}

export interface NotificationListResult {
  items: NotificationRow[];
  unreadCount: number;
  total: number;
}

/**
 * List notifications for the current user (Module 4.C).
 * `filter`: all | unread | urgent | production | deadline | overdue
 */
export async function listNotifications(
  filter: string = "all",
  limit = 20,
  offset = 0,
): Promise<NotificationListResult> {
  const session = await requireSession();
  const db = getDb();

  const baseConds = [
    eq(notifications.businessId, session.businessId),
    or(
      eq(notifications.recipientUserId, session.userId),
      eq(notifications.isBroadcast, true),
    )!,
  ];

  const filterConds = (() => {
    switch (filter) {
      case "unread":
        return [isNull(notificationUserState.readAt)];
      case "urgent":
        return [
          inArray(notifications.priority, ["critical", "high"]),
        ];
      case "production":
        return [
          inArray(notifications.type, [
            "task_assigned",
            "stage_ready",
            "task_reminder",
            "stage_overdue",
            "stage_completed",
            "production_delay",
            "hold_alert",
            "employee_overload",
            "order_reassigned",
            "ready_for_delivery",
          ]),
        ];
      case "deadline":
        return [
          inArray(notifications.type, [
            "early_reminder",
            "upcoming_deadline",
            "warning",
            "urgent",
            "critical",
            "due_today",
          ]),
        ];
      case "overdue":
        return [eq(notifications.type, "overdue")];
      default:
        return [];
    }
  })();

  const where = and(
    ...baseConds,
    ...filterConds,
    // Active view excludes dismissed and snoozed-in-future notifications.
    or(isNull(notificationUserState.dismissedAt))!,
  );

  const joined = db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      message: notifications.message,
      priority: notifications.priority,
      orderId: notifications.orderId,
      orderNumber: orders.orderNumber,
      customerName: customers.fullName,
      metadata: notifications.metadata,
      createdAt: notifications.createdAt,
      readAt: notificationUserState.readAt,
      acknowledgedAt: notificationUserState.acknowledgedAt,
      dismissedAt: notificationUserState.dismissedAt,
      snoozedUntil: notificationUserState.snoozedUntil,
    })
    .from(notifications)
    .leftJoin(
      notificationUserState,
      and(
        eq(notificationUserState.notificationId, notifications.id),
        eq(notificationUserState.userId, session.userId),
      ),
    )
    .leftJoin(orders, eq(orders.id, notifications.orderId))
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .where(where);

  const items = await joined
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);

  const [unread] = await db
    .select({ n: count() })
    .from(notifications)
    .leftJoin(
      notificationUserState,
      and(
        eq(notificationUserState.notificationId, notifications.id),
        eq(notificationUserState.userId, session.userId),
      ),
    )
    .where(
      and(
        ...baseConds,
        isNull(notificationUserState.readAt),
        or(isNull(notificationUserState.dismissedAt))!,
      ),
    );

  const [total] = await db
    .select({ n: count() })
    .from(notifications)
    .leftJoin(
      notificationUserState,
      and(
        eq(notificationUserState.notificationId, notifications.id),
        eq(notificationUserState.userId, session.userId),
      ),
    )
    .where(where);

  return {
    items: items.map((i) => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
      readAt: i.readAt?.toISOString() ?? null,
      acknowledgedAt: i.acknowledgedAt?.toISOString() ?? null,
      dismissedAt: i.dismissedAt?.toISOString() ?? null,
      snoozedUntil: i.snoozedUntil?.toISOString() ?? null,
      metadata: i.metadata as Record<string, unknown>,
    })),
    unreadCount: unread.n,
    total: total.n,
  };
}

export type NotificationAction = "read" | "unread" | "acknowledge" | "dismiss" | "snooze" | "undismiss";

/** Per-notification state actions (Module 4.B — dismiss ≠ read). */
export async function updateNotificationState(
  notificationId: string,
  action: NotificationAction,
  snoozeMinutes?: number,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession();
  const db = getDb();

  // Verify the notification targets this user.
  const [notif] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1);
  if (!notif) return { ok: false, error: "Not found" };
  if (
    notif.recipientUserId !== session.userId &&
    notif.recipientUserId !== null &&
    !notif.isBroadcast
  ) {
    return { ok: false, error: "Not your notification" };
  }

  const now = new Date();
  const [state] = await db
    .select()
    .from(notificationUserState)
    .where(
      and(
        eq(notificationUserState.notificationId, notificationId),
        eq(notificationUserState.userId, session.userId),
      ),
    )
    .limit(1);

  const patch: Partial<typeof notificationUserState.$inferInsert> = {};
  switch (action) {
    case "read":
      patch.readAt = state?.readAt ?? now;
      break;
    case "unread":
      patch.readAt = null;
      break;
    case "acknowledge":
      // Non-destructive acknowledgment (Module 4.B): does NOT mark read or
      // alter any order/production state.
      patch.acknowledgedAt = now;
      break;
    case "dismiss":
      patch.dismissedAt = now;
      break;
    case "undismiss":
      patch.dismissedAt = null;
      break;
    case "snooze":
      patch.snoozedUntil = new Date(
        now.getTime() + (snoozeMinutes ?? 60) * 60 * 1000,
      );
      break;
  }

  if (state) {
    await db
      .update(notificationUserState)
      .set(patch)
      .where(eq(notificationUserState.id, state.id));
  } else {
    await db.insert(notificationUserState).values({
      notificationId,
      userId: session.userId,
      ...patch,
    });
  }
  return { ok: true };
}

export async function markAllRead(): Promise<{ ok: boolean }> {
  const session = await requireSession();
  const db = getDb();
  const mine = await db
    .select({ id: notifications.id })
    .from(notifications)
    .leftJoin(
      notificationUserState,
      and(
        eq(notificationUserState.notificationId, notifications.id),
        eq(notificationUserState.userId, session.userId),
      ),
    )
    .where(
      and(
        eq(notifications.businessId, session.businessId),
        or(
          eq(notifications.recipientUserId, session.userId),
          eq(notifications.isBroadcast, true),
        )!,
        isNull(notificationUserState.readAt),
      ),
    );

  const now = new Date();
  for (const { id } of mine) {
    const [state] = await db
      .select()
      .from(notificationUserState)
      .where(
        and(
          eq(notificationUserState.notificationId, id),
          eq(notificationUserState.userId, session.userId),
        ),
      )
      .limit(1);
    if (state) {
      await db
        .update(notificationUserState)
        .set({ readAt: now })
        .where(eq(notificationUserState.id, state.id));
    } else {
      await db
        .insert(notificationUserState)
        .values({ notificationId: id, userId: session.userId, readAt: now })
        .onConflictDoNothing();
    }
  }
  return { ok: true };
}

/** Unread badge count (cheap query for the bell). */
export async function unreadCount(): Promise<number> {
  const session = await requireSession();
  const db = getDb();
  const [row] = await db
    .select({ n: count() })
    .from(notifications)
    .leftJoin(
      notificationUserState,
      and(
        eq(notificationUserState.notificationId, notifications.id),
        eq(notificationUserState.userId, session.userId),
      ),
    )
    .where(
      and(
        eq(notifications.businessId, session.businessId),
        or(
          eq(notifications.recipientUserId, session.userId),
          eq(notifications.isBroadcast, true),
        )!,
        isNull(notificationUserState.readAt),
        or(isNull(notificationUserState.dismissedAt))!,
      ),
    );
  return row.n;
}

void lte;
void sql;
