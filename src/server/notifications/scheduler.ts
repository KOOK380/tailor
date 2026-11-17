/**
 * Server-side scheduled notification processing (Module 4.A/F/G, Module 5).
 *
 * NOT frontend timers: this module is invoked by
 *   - POST /api/cron/deadline-check (Vercel Cron in production, `npm run
 *     scheduler` locally) — hourly sweep
 *   - event-driven hooks in events.ts for instant alerts.
 *
 * Every generator is idempotent: the unique event_key makes re-running a sweep
 * a no-op for already-created alerts.
 */
import { eq, and, ne, inArray, asc, lte, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  businesses,
  orders,
  orderStageProgress,
  customers,
  employees,
  notificationRules,
  STAGE_LABELS,
} from "@/db/schema";
import {
  createNotifications,
  adminRecipientIds,
  employeeUserId,
  getDeadlineSettings,
  type NotificationTarget,
} from "./engine";
import {
  daysRemaining,
  todayInTimezone,
  reminderTypesForDaysLeft,
  REMINDER_PRIORITY,
  formatDeliveryDate,
  type ReminderType,
} from "@/lib/deadline";

/* ------------------------------------------------------------------ */
/* 1. Delivery deadline reminders (Module 4.A)                         */
/* ------------------------------------------------------------------ */

export const REMINDER_MESSAGES: Record<
  ReminderType,
  (ctx: { orderNumber: string; stage: string; customerName: string; days: number; overdueDays: number }) => string
> = {
  early_reminder: ({ orderNumber, stage, days }) =>
    `Order #${orderNumber} has ${days} days remaining before delivery. Current production stage: ${stage}. Please monitor progress.`,
  upcoming_deadline: ({ orderNumber, stage, days }) =>
    `Order #${orderNumber} has ${days} days left. Current stage: ${stage}. Make sure production is on schedule.`,
  warning: ({ orderNumber, stage, days }) =>
    `Warning! Order #${orderNumber} must be delivered in ${days} days. Current stage: ${stage}. Review the remaining work.`,
  urgent: ({ orderNumber, stage }) =>
    `URGENT: Only 2 days remaining for Order #${orderNumber}. Production is still at ${stage}. Immediate attention required.`,
  critical: ({ orderNumber, stage }) =>
    `CRITICAL DELIVERY ALERT! Order #${orderNumber} is due tomorrow. Current stage: ${stage}. Complete the order immediately.`,
  due_today: ({ orderNumber, customerName }) =>
    `DELIVERY TODAY! Order #${orderNumber} for ${customerName} is scheduled for delivery today. Confirm whether the garment is ready.`,
  overdue: ({ orderNumber, overdueDays, stage }) =>
    `OVERDUE ALERT! Order #${orderNumber} was due ${overdueDays} day${overdueDays === 1 ? "" : "s"} ago and has not been delivered. Current status: ${stage}.`,
};

export const REMINDER_TITLES: Record<ReminderType, string> = {
  early_reminder: "Delivery Reminder — 7 Days Left",
  upcoming_deadline: "Upcoming Delivery — 5 Days Left",
  warning: "Delivery Warning — 3 Days Left",
  urgent: "URGENT DELIVERY ALERT",
  critical: "CRITICAL DELIVERY ALERT",
  due_today: "DELIVERY TODAY",
  overdue: "OVERDUE ALERT",
};

export interface SweepResult {
  deadline: number;
  delay: number;
  summary: number;
  overdue: number;
}

export async function processDeadlineReminders(
  businessId: string,
  now: Date = new Date(),
): Promise<number> {
  const db = getDb();
  const settings = await getDeadlineSettings(businessId);
  const today = todayInTimezone(settings.timezone, now);

  const activeOrders = await db
    .select({ order: orders, customerName: customers.fullName })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(
      and(
        eq(orders.businessId, businessId),
        inArray(orders.status, ["new", "in_production", "on_hold", "finished", "ready_for_delivery"]),
      ),
    );

  const admins = await adminRecipientIds(businessId);
  let created = 0;

  for (const { order, customerName } of activeOrders) {
    const days = daysRemaining(order.deliveryDate, settings.timezone, now);
    const reminders = reminderTypesForDaysLeft(days, settings.reminderDays);

    // Overdue: daily recurring (event key includes the overdue calendar date).
    if (days < 0 && !settings.overdueAlertsEnabled) {
      continue;
    }

    for (const reminder of reminders) {
      // Skip threshold rules disabled in notification_rules.
      const ruleThreshold =
        reminder.type === "overdue" ? null : reminder.days;
      const enabled =
        reminder.type === "overdue"
          ? settings.overdueAlertsEnabled
          : await ruleEnabledFor(businessId, "deadline_reminder", ruleThreshold);
      if (!enabled) continue;

      const stageName =
        (STAGE_LABELS as Record<string, string>)[order.currentStageKey] ??
        order.currentStageKey.replace(/_/g, " ");
      const isOverdue = reminder.type === "overdue";
      const eventKey = isOverdue
        ? `deadline:${order.id}:overdue:${today}`
        : `deadline:${order.id}:${reminder.type}:${order.deliveryDate}`;
      const statusLabel = order.status
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      const targets: NotificationTarget[] = [];
      for (const uid of admins) {
        targets.push({
          userId: uid,
          type: reminder.type,
          title: REMINDER_TITLES[reminder.type],
          message: REMINDER_MESSAGES[reminder.type]({
            orderNumber: order.orderNumber,
            stage: isOverdue ? statusLabel : stageName,
            customerName,
            days: Math.max(reminder.days, days),
            overdueDays: Math.abs(days),
          }),
          priority: REMINDER_PRIORITY[reminder.type],
          eventKey,
          orderId: order.id,
          metadata: {
            daysLeft: days,
            deliveryDate: order.deliveryDate,
            stage: order.currentStageKey,
          },
          // Stale reminders shouldn't linger past delivery + 7 days.
          expiresAt: new Date(now.getTime() + 30 * 24 * 3600 * 1000),
        });
      }
      created += await createNotifications(businessId, targets);
    }
  }
  return created;
}

async function ruleEnabledFor(
  businessId: string,
  ruleType: string,
  threshold: number | null,
): Promise<boolean> {
  const db = getDb();
  // notification_rules may disable a specific threshold (e.g. turn off 7-day).
  const rows = await db
    .select()
    .from(notificationRules)
    .where(
      and(
        eq(notificationRules.businessId, businessId),
        eq(notificationRules.ruleType, ruleType),
        threshold === null
          ? isNull(notificationRules.threshold)
          : eq(notificationRules.threshold, threshold),
      ),
    )
    .limit(1);
  return rows.length === 0 || rows[0].enabled;
}

/* ------------------------------------------------------------------ */
/* 2. Production delay detection (Module 4.F)                          */
/* ------------------------------------------------------------------ */

export async function processDelayDetection(
  businessId: string,
  now: Date = new Date(),
): Promise<number> {
  const db = getDb();
  const settings = await getDeadlineSettings(businessId);
  if (!settings.delayWarningsEnabled) return 0;

  const admins = await adminRecipientIds(businessId);
  const today = todayInTimezone(settings.timezone, now);
  const targets: NotificationTarget[] = [];

  // (a) Stage not started by its planned start date, or exceeding planned duration.
  const runningStages = await db
    .select({ stage: orderStageProgress, orderNumber: orders.orderNumber })
    .from(orderStageProgress)
    .innerJoin(orders, eq(orderStageProgress.orderId, orders.id))
    .where(
      and(
        eq(orderStageProgress.businessId, businessId),
        inArray(orderStageProgress.status, ["not_started", "in_progress", "on_hold"]),
        ne(orders.status, "delivered"),
        ne(orders.status, "cancelled"),
      ),
    );

  for (const { stage, orderNumber } of runningStages) {
    // Not started past planned start.
    if (
      stage.status === "not_started" &&
      stage.plannedStartDate &&
      stage.plannedStartDate < today
    ) {
      const eventKey = `delay_not_started:${stage.id}:${today}`;
      for (const uid of admins) {
        targets.push({
          userId: uid,
          type: "production_delay",
          title: "Production Delay",
          message: `Production Delay: ${stage.stageName} for Order #${orderNumber} has not started though it was planned to begin on ${stage.plannedStartDate}.`,
          priority: "high",
          eventKey,
          orderId: stage.orderId,
          metadata: { stageKey: stage.stageKey, kind: "not_started" },
        });
      }
    }

    // In progress beyond estimated duration.
    if (stage.status === "in_progress" && stage.actualStartedAt && stage.estimatedDurationHours) {
      const hoursElapsed =
        (now.getTime() - stage.actualStartedAt.getTime()) / (1000 * 3600);
      if (hoursElapsed > stage.estimatedDurationHours * 1.5) {
        const daysIn = Math.floor(hoursElapsed / 24);
        const plannedDays = Math.max(1, Math.round(stage.estimatedDurationHours / 24));
        if (daysIn > plannedDays) {
          const eventKey = `delay_overrun:${stage.id}:${today}`;
          for (const uid of admins) {
            targets.push({
              userId: uid,
              type: "production_delay",
              title: "Production Delay",
              message: `Production Delay: Order #${orderNumber} has been in ${stage.stageName} for ${daysIn} days, exceeding its planned duration of ${plannedDays} days.`,
              priority: "high",
              eventKey,
              orderId: stage.orderId,
              metadata: { stageKey: stage.stageKey, kind: "overrun" },
            });
          }
        }
      }
    }

    // On hold beyond allowed period.
    if (stage.status === "on_hold" && stage.updatedAt) {
      const daysOnHold = Math.floor(
        (now.getTime() - stage.updatedAt.getTime()) / (24 * 3600 * 1000),
      );
      if (daysOnHold >= settings.holdAlertDays) {
        const eventKey = `delay_hold:${stage.id}:${today}`;
        for (const uid of admins) {
          targets.push({
            userId: uid,
            type: "hold_alert",
            title: "Stage On Hold Too Long",
            message: `${stage.stageName} for Order #${orderNumber} has been On Hold for ${daysOnHold} days. Review the hold reason and resume or reassign.`,
            priority: "medium",
            eventKey,
            orderId: stage.orderId,
            metadata: { stageKey: stage.stageKey, kind: "hold" },
          });
        }
      }
    }

    // (b) Employee overload: too many urgent assigned tasks.
    if (stage.assignedEmployeeId && stage.status !== "completed") {
      const empStages = await db
        .select()
        .from(orderStageProgress)
        .innerJoin(orders, eq(orderStageProgress.orderId, orders.id))
        .where(
          and(
            eq(orderStageProgress.assignedEmployeeId, stage.assignedEmployeeId),
            inArray(orderStageProgress.status, ["not_started", "in_progress"]),
            inArray(orders.priority, ["urgent", "critical"]),
            ne(orders.status, "delivered"),
          ),
        );
      if (empStages.length > settings.maxUrgentTasksPerEmployee) {
        const empUserId = await employeeUserId(
          businessId,
          stage.assignedEmployeeId,
        );
        const [emp] = await db
          .select()
          .from(employees)
          .where(eq(employees.id, stage.assignedEmployeeId))
          .limit(1);
        const eventKey = `employee_overload:${stage.assignedEmployeeId}:${today}`;
        const overloadTargets: NotificationTarget[] = [];
        if (empUserId) {
          overloadTargets.push({
            userId: empUserId,
            type: "employee_overload",
            title: "Heavy Workload",
            message: `You have ${empStages.length} urgent tasks scheduled for completion. Consider discussing priorities with your manager.`,
            priority: "medium",
            eventKey,
          });
        }
        for (const uid of admins) {
          overloadTargets.push({
            userId: uid,
            type: "employee_overload",
            title: "Employee Overload",
            message: `${emp?.fullName ?? "An employee"} has ${empStages.length} urgent assigned tasks — above the configured limit of ${settings.maxUrgentTasksPerEmployee}.`,
            priority: "medium",
            eventKey,
          });
        }
        targets.push(...overloadTargets);
      }
    }
  }

  // (c) Order approaching delivery with several incomplete stages.
  const atRisk = await db
    .select({ order: orders, customerName: customers.fullName })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(
      and(
        eq(orders.businessId, businessId),
        inArray(orders.status, ["new", "in_production", "on_hold"]),
      ),
    );
  for (const { order } of atRisk) {
    const days = daysRemaining(order.deliveryDate, settings.timezone, now);
    if (days > 3 || days < 0) continue;
    const stages = await db
      .select()
      .from(orderStageProgress)
      .where(eq(orderStageProgress.orderId, order.id));
    const remaining = stages.filter(
      (s) => s.status !== "completed" && s.status !== "skipped",
    );
    if (remaining.length >= 3) {
      const eventKey = `delay_at_risk:${order.id}:${today}`;
      for (const uid of admins) {
        targets.push({
          userId: uid,
          type: "production_delay",
          title: "Delivery At Risk",
          message: `Order #${order.orderNumber} has ${remaining.length} incomplete stages with only ${days} day${days === 1 ? "" : "s"} left before delivery.`,
          priority: "high",
          eventKey,
          orderId: order.id,
          metadata: { remainingStages: remaining.map((s) => s.stageKey) },
        });
      }
    }
  }

  return createNotifications(businessId, targets);
}

/* ------------------------------------------------------------------ */
/* 3. Daily summary (Module 4.G)                                       */
/* ------------------------------------------------------------------ */

export async function processDailySummary(
  businessId: string,
  now: Date = new Date(),
): Promise<number> {
  const db = getDb();
  const settings = await getDeadlineSettings(businessId);
  if (!settings.dailySummaryEnabled) return 0;

  const today = todayInTimezone(settings.timezone, now);

  // Fire only once per day per business (event_key includes the date), and
  // only when the configured local time has been reached.
  const [hh, mm] = settings.dailySummaryTime.split(":").map(Number);
  const currentParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: settings.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const [curH, curM] = currentParts.split(":").map(Number);
  const nowMinutes = curH * 60 + curM;
  if (nowMinutes < (hh ?? 9) * 60 + (mm ?? 0)) return 0;

  const activeStatuses = [
    "new",
    "in_production",
    "on_hold",
    "finished",
    "ready_for_delivery",
  ] as const;
  const activeOrders = await db
    .select({ order: orders })
    .from(orders)
    .where(
      and(
        eq(orders.businessId, businessId),
        inArray(orders.status, activeStatuses),
      ),
    );

  let dueToday = 0;
  let dueTomorrow = 0;
  let dueIn3 = 0;
  let overdue = 0;
  for (const { order } of activeOrders) {
    const d = daysRemaining(order.deliveryDate, settings.timezone, now);
    if (d < 0) overdue += 1;
    else if (d === 0) dueToday += 1;
    else if (d === 1) dueTomorrow += 1;
    else if (d <= 3) dueIn3 += 1;
  }

  // Delayed stages count.
  const stages = await db
    .select({ stage: orderStageProgress })
    .from(orderStageProgress)
    .innerJoin(orders, eq(orderStageProgress.orderId, orders.id))
    .where(
      and(
        eq(orderStageProgress.businessId, businessId),
        eq(orderStageProgress.status, "in_progress"),
        ne(orders.status, "delivered"),
      ),
    );
  const delayed = stages.filter((s) => {
    if (!s.stage.actualStartedAt || !s.stage.estimatedDurationHours) return false;
    const hours = (now.getTime() - s.stage.actualStartedAt.getTime()) / 3600000;
    return hours > s.stage.estimatedDurationHours * 1.5;
  }).length;

  const stageCounts = await db
    .select({
      key: orderStageProgress.stageKey,
      n: sql<number>`count(*)::int`,
    })
    .from(orderStageProgress)
    .innerJoin(orders, eq(orderStageProgress.orderId, orders.id))
    .where(
      and(
        eq(orderStageProgress.businessId, businessId),
        eq(orderStageProgress.status, "in_progress"),
        ne(orders.status, "delivered"),
      ),
    )
    .groupBy(orderStageProgress.stageKey);
  const stitching = stageCounts.find((s) => s.key === "stitching")?.n ?? 0;

  const lines = [
    `Date: ${formatDeliveryDate(today)}`,
    `- ${dueToday} orders due today.`,
    `- ${dueTomorrow} orders due tomorrow.`,
    `- ${dueIn3} orders due within 3 days.`,
    `- ${overdue} overdue orders.`,
    `- ${delayed} delayed production stages.`,
    `- ${stitching} orders currently in Stitching.`,
  ];

  const admins = await adminRecipientIds(businessId);
  return createNotifications(
    businessId,
    admins.map((uid) => ({
      userId: uid,
      type: "daily_summary" as const,
      title: "Daily Production Summary",
      message: lines.join("\n"),
      priority: "medium" as const,
      eventKey: `daily_summary:${today}`,
      metadata: {
        dueToday,
        dueTomorrow,
        dueIn3,
        overdue,
        delayed,
        stitching,
        date: today,
      },
    })),
  );
}

/* ------------------------------------------------------------------ */
/* 4. Employee task reminders (Module 4.E)                             */
/* ------------------------------------------------------------------ */

export async function processTaskReminders(
  businessId: string,
  now: Date = new Date(),
): Promise<number> {
  const db = getDb();
  const settings = await getDeadlineSettings(businessId);
  const today = todayInTimezone(settings.timezone, now);
  const admins = await adminRecipientIds(businessId);

  // Group pending assigned stages per employee.
  const assigned = await db
    .select({
      stage: orderStageProgress,
      employee: employees,
      orderNumber: orders.orderNumber,
      priority: orders.priority,
    })
    .from(orderStageProgress)
    .innerJoin(employees, eq(orderStageProgress.assignedEmployeeId, employees.id))
    .innerJoin(orders, eq(orderStageProgress.orderId, orders.id))
    .where(
      and(
        eq(orderStageProgress.businessId, businessId),
        inArray(orderStageProgress.status, ["not_started", "in_progress"]),
        ne(orders.status, "delivered"),
        ne(orders.status, "cancelled"),
      ),
    );

  const byEmployee = new Map<
    string,
    { name: string; userId: string | null; tasks: typeof assigned }
  >();
  for (const row of assigned) {
    const key = row.employee.id;
    const entry = byEmployee.get(key) ?? {
      name: row.employee.fullName,
      userId: row.employee.userId,
      tasks: [] as typeof assigned,
    };
    entry.tasks.push(row);
    byEmployee.set(key, entry);
  }

  const targets: NotificationTarget[] = [];
  for (const [empId, entry] of byEmployee) {
    if (entry.tasks.length === 0) continue;
    if (entry.userId) {
      targets.push({
        userId: entry.userId,
        type: "task_reminder",
        title: "Task Reminder",
        message: `You have ${entry.tasks.length} pending task${entry.tasks.length === 1 ? "" : "s"} scheduled for completion.`,
        priority: "medium",
        eventKey: `task_reminder:${empId}:${today}`,
        metadata: {
          tasks: entry.tasks.map((t) => ({
            orderNumber: t.orderNumber,
            stage: t.stage.stageName,
          })),
        },
      });
    }
    // Stage-overdue per task (planned completion passed).
    for (const t of entry.tasks) {
      if (t.stage.plannedCompletionDate && t.stage.plannedCompletionDate < today) {
        const eventKey = `stage_overdue:${t.stage.id}:${today}`;
        if (entry.userId) {
          targets.push({
            userId: entry.userId,
            type: "stage_overdue",
            title: "Stage Overdue",
            message: `Your assigned ${t.stage.stageName} task for Order #${t.orderNumber} is past its planned completion date.`,
            priority: "high",
            eventKey,
            orderId: t.stage.orderId,
          });
        }
        for (const uid of admins) {
          targets.push({
            userId: uid,
            type: "stage_overdue",
            title: "Stage Overdue",
            message: `${t.stage.stageName} for Order #${t.orderNumber} (${entry.name}) is past its planned completion date.`,
            priority: "high",
            eventKey,
            orderId: t.stage.orderId,
          });
        }
      }
    }
  }
  return createNotifications(businessId, targets);
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export async function runNotificationSweep(now: Date = new Date()): Promise<SweepResult> {
  const db = getDb();
  const allBusinesses = await db.select().from(businesses);
  const result: SweepResult = { deadline: 0, delay: 0, summary: 0, overdue: 0 };

  for (const biz of allBusinesses) {
    result.deadline += await processDeadlineReminders(biz.id, now);
    result.delay += await processDelayDetection(biz.id, now);
    result.summary += await processDailySummary(biz.id, now);
    result.overdue += await processTaskReminders(biz.id, now);
  }
  return result;
}

void isNull;
