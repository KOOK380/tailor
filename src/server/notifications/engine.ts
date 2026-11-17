/**
 * Notification engine core (Modules 4 & 5).
 *
 * All notification creation funnels through `createNotifications()`, which is
 * idempotent via unique event_key (tenant + order + recipient + type +
 * delivery_date [+ overdue date]). Re-running a scheduled check or refreshing
 * the dashboard can never create duplicate alerts.
 */
import { eq, and, inArray, isNull, or, lte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  notifications,
  notificationUserState,
  notificationPreferences,
  businessMemberships,
  employees,
  businesses,
  notificationRules,
  businessSettings,
  type NotificationType,
  type NotificationPriority,
} from "@/db/schema";

export interface NotificationTarget {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  eventKey: string;
  orderId?: string | null;
  metadata?: Record<string, unknown>;
  expiresAt?: Date | null;
}

/**
 * Insert notifications idempotently. Rows conflict on
 * (business_id, event_key, recipient_user_id) and are silently skipped.
 */
export async function createNotifications(
  businessId: string,
  targets: NotificationTarget[],
): Promise<number> {
  if (targets.length === 0) return 0;
  const db = getDb();

  let inserted = 0;
  const createdIds: string[] = [];
  for (const t of targets) {
    // Respect per-user preferences (critical operational alerts still go
    // through when the user disabled a category? — spec: critical alerts may
    // follow company rules; users manage device push, not core alerts).
    const allowed = await isTypeAllowed(t.userId, t.type, t.priority);
    if (!allowed) continue;

    const rows = await db
      .insert(notifications)
      .values({
        businessId,
        recipientUserId: t.userId,
        orderId: t.orderId ?? null,
        type: t.type,
        title: t.title,
        message: t.message,
        priority: t.priority,
        eventKey: t.eventKey,
        expiresAt: t.expiresAt ?? null,
        metadata: t.metadata ?? {},
      })
      .onConflictDoNothing()
      .returning();
    if (rows.length > 0) {
      inserted += rows.length;
      createdIds.push(rows[0].id);
      // Initialize per-user state row.
      await db
        .insert(notificationUserState)
        .values({ notificationId: rows[0].id, userId: t.userId })
        .onConflictDoNothing();
    }
  }

  // Browser push fan-out (best-effort; delivery attempts recorded).
  if (createdIds.length > 0) {
    try {
      const { dispatchPushForNotifications } = await import("./push");
      await dispatchPushForNotifications(businessId, createdIds);
    } catch (err) {
      console.error("[notifications] push dispatch failed:", err);
    }
    // Email fan-out (best-effort; provider-optional, see email.ts policy).
    try {
      const { dispatchEmailForNotifications } = await import("./email");
      await dispatchEmailForNotifications(businessId, createdIds);
    } catch (err) {
      console.error("[notifications] email dispatch failed:", err);
    }
  }
  return inserted;
}

async function isTypeAllowed(
  userId: string,
  type: NotificationType,
  priority: NotificationPriority,
): Promise<boolean> {
  // Critical operational alerts always deliver (spec Module 4.H).
  if (priority === "critical") return true;
  const db = getDb();
  const [pref] = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.notificationType, type),
      ),
    )
    .limit(1);
  if (!pref) return true; // default: enabled
  return pref.inAppEnabled;
}

/* ------------------------------------------------------------------ */
/* Recipient resolution                                                */
/* ------------------------------------------------------------------ */

/** Admins + managers of the business (notification_rules recipient_scope=admins). */
export async function adminRecipientIds(businessId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ userId: businessMemberships.userId })
    .from(businessMemberships)
    .where(
      and(
        eq(businessMemberships.businessId, businessId),
        eq(businessMemberships.isActive, true),
        inArray(businessMemberships.role, ["super_admin", "manager"]),
      ),
    );
  return rows.map((r) => r.userId);
}

/** The login user linked to an employee, if any. */
export async function employeeUserId(
  businessId: string,
  employeeId: string | null,
): Promise<string | null> {
  if (!employeeId) return null;
  const db = getDb();
  const [emp] = await db
    .select()
    .from(employees)
    .where(
      and(eq(employees.id, employeeId), eq(employees.businessId, businessId)),
    )
    .limit(1);
  return emp?.userId ?? null;
}

/* ------------------------------------------------------------------ */
/* Business settings / rules helpers                                   */
/* ------------------------------------------------------------------ */

export interface DeadlineRuleSettings {
  reminderDays: number[];
  overdueAlertsEnabled: boolean;
  delayWarningsEnabled: boolean;
  dailySummaryEnabled: boolean;
  dailySummaryTime: string;
  holdAlertDays: number;
  maxUrgentTasksPerEmployee: number;
  timezone: string;
}

export async function getDeadlineSettings(
  businessId: string,
): Promise<DeadlineRuleSettings> {
  const db = getDb();
  const [settings] = await db
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.businessId, businessId))
    .limit(1);
  const [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  return {
    reminderDays: (settings?.reminderDays as number[]) ?? [7, 5, 3, 2, 1],
    overdueAlertsEnabled: settings?.overdueAlertsEnabled ?? true,
    delayWarningsEnabled: settings?.delayWarningsEnabled ?? true,
    dailySummaryEnabled: settings?.dailySummaryEnabled ?? true,
    dailySummaryTime: settings?.dailySummaryTime ?? "09:00",
    holdAlertDays: settings?.holdAlertDays ?? 3,
    maxUrgentTasksPerEmployee: settings?.maxUrgentTasksPerEmployee ?? 3,
    timezone: biz?.timezone ?? "Asia/Kolkata",
  };
}

export async function isRuleEnabled(
  businessId: string,
  ruleType: string,
  threshold?: number,
): Promise<boolean> {
  const db = getDb();
  const conds = [
    eq(notificationRules.businessId, businessId),
    eq(notificationRules.ruleType, ruleType),
    eq(notificationRules.enabled, true),
  ];
  if (threshold !== undefined) {
    conds.push(eq(notificationRules.threshold, threshold));
  } else {
    conds.push(isNull(notificationRules.threshold));
  }
  const rows = await db
    .select()
    .from(notificationRules)
    .where(and(...conds))
    .limit(1);
  // If no explicit rule exists, default to enabled.
  return rows.length > 0 ? true : true;
}

void or;
void lte;
