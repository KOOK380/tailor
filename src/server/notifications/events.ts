/**
 * Event-driven notification generators (Module 4.A/E/F).
 *
 * Called inline from order/stage mutation transactions' aftermath. Message
 * formats follow the spec exactly.
 */
import { eq, and, inArray, asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  orders,
  orderStageProgress,
  orderItems,
  customers,
  employees,
  STAGE_LABELS,
} from "@/db/schema";
import {
  createNotifications,
  adminRecipientIds,
  employeeUserId,
  type NotificationTarget,
} from "./engine";

async function orderContext(businessId: string, orderId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      order: orders,
      customerName: customers.fullName,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(and(eq(orders.id, orderId), eq(orders.businessId, businessId)))
    .limit(1);
  return row ?? null;
}

/** Format "Order #ORD-1025" with current stage name. */
function stageLabel(key: string): string {
  return (STAGE_LABELS as Record<string, string>)[key] ?? key.replace(/_/g, " ");
}

/* ------------------------------------------------------------------ */
/* Stage events                                                        */
/* ------------------------------------------------------------------ */

export async function onStageCompleted(
  businessId: string,
  stageProgressId: string,
): Promise<void> {
  const db = getDb();
  const [stage] = await db
    .select()
    .from(orderStageProgress)
    .where(eq(orderStageProgress.id, stageProgressId))
    .limit(1);
  if (!stage) return;
  const ctx = await orderContext(businessId, stage.orderId);
  if (!ctx) return;

  const targets: NotificationTarget[] = [];
  const admins = await adminRecipientIds(businessId);
  const doneName = stage.stageName;

  // Notify admins: stage completed.
  for (const uid of admins) {
    targets.push({
      userId: uid,
      type: "stage_completed",
      title: `${doneName} Completed`,
      message: `${doneName} completed for Order #${ctx.order.orderNumber}. Next stage can now begin.`,
      priority: "medium",
      eventKey: `stage_completed:${stageProgressId}`,
      orderId: stage.orderId,
      metadata: { stageKey: stage.stageKey },
    });
  }

  // Find the next non-skipped stage of the same item → notify its assignee.
  const siblings = await db
    .select()
    .from(orderStageProgress)
    .where(eq(orderStageProgress.orderItemId, stage.orderItemId))
    .orderBy(asc(orderStageProgress.sequence));
  const next = siblings.find(
    (s) =>
      s.sequence > stage.sequence &&
      s.status !== "skipped" &&
      s.status !== "completed",
  );
  if (next) {
    const nextUserId = await employeeUserId(businessId, next.assignedEmployeeId);
    if (nextUserId) {
      targets.push({
        userId: nextUserId,
        type: "stage_ready",
        title: "Stage Ready to Start",
        message: `Order #${ctx.order.orderNumber} is ready for ${next.stageName}. Please begin your assigned work.`,
        priority: "high",
        eventKey: `stage_ready:${next.id}`,
        orderId: stage.orderId,
        metadata: { stageKey: next.stageKey },
      });
    }
  }

  // If production finished → ready-for-delivery alert to admins.
  const allDone = siblings.every(
    (s) => s.status === "completed" || s.status === "skipped",
  );
  if (allDone) {
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, stage.orderId));
    const everythingDone = await Promise.all(
      items.map(async (item) => {
        const rows = await db
          .select()
          .from(orderStageProgress)
          .where(eq(orderStageProgress.orderItemId, item.id));
        return rows.every((s) => s.status === "completed" || s.status === "skipped");
      }),
    );
    if (everythingDone.every(Boolean)) {
      for (const uid of admins) {
        targets.push({
          userId: uid,
          type: "ready_for_delivery",
          title: "Ready for Delivery",
          message: `Order #${ctx.order.orderNumber} for ${ctx.customerName} has finished production and is ready for delivery.`,
          priority: "high",
          eventKey: `ready_for_delivery:${stage.orderId}`,
          orderId: stage.orderId,
        });
      }
    }
  }

  await createNotifications(businessId, targets);
}

export async function onStageStarted(
  businessId: string,
  stageProgressId: string,
): Promise<void> {
  // Kept lightweight: activity log already records the start; a broadcast is
  // only useful for admins monitoring the board.
  const db = getDb();
  const [stage] = await db
    .select()
    .from(orderStageProgress)
    .where(eq(orderStageProgress.id, stageProgressId))
    .limit(1);
  if (!stage) return;
  const ctx = await orderContext(businessId, stage.orderId);
  if (!ctx) return;
  const admins = await adminRecipientIds(businessId);
  await createNotifications(
    businessId,
    admins.map((uid) => ({
      userId: uid,
      type: "stage_completed" as const, // reuse production_updates category
      title: `${stage.stageName} Started`,
      message: `${stage.stageName} started for Order #${ctx.order.orderNumber}.`,
      priority: "low" as const,
      eventKey: `stage_started:${stageProgressId}`,
      orderId: stage.orderId,
    })),
  );
}

export async function onStageAssigned(
  businessId: string,
  stageProgressId: string,
  newEmployeeId: string | null,
  previousEmployeeId: string | null,
): Promise<void> {
  const db = getDb();
  const [stage] = await db
    .select()
    .from(orderStageProgress)
    .where(eq(orderStageProgress.id, stageProgressId))
    .limit(1);
  if (!stage) return;
  const ctx = await orderContext(businessId, stage.orderId);
  if (!ctx) return;

  const targets: NotificationTarget[] = [];

  if (newEmployeeId) {
    const newUserId = await employeeUserId(businessId, newEmployeeId);
    if (newUserId) {
      targets.push({
        userId: newUserId,
        type: "task_assigned",
        title: "New Task Assigned",
        message: `You have been assigned ${stage.stageName} for Order #${ctx.order.orderNumber}.`,
        priority: "high",
        eventKey: `task_assigned:${stageProgressId}:${newEmployeeId}`,
        orderId: stage.orderId,
        metadata: { stageKey: stage.stageKey },
      });
    }
  }

  // Reassignment: notify previous employee their task moved (history kept).
  if (previousEmployeeId && previousEmployeeId !== newEmployeeId) {
    const prevUserId = await employeeUserId(businessId, previousEmployeeId);
    if (prevUserId) {
      targets.push({
        userId: prevUserId,
        type: "order_reassigned",
        title: "Task Reassigned",
        message: `Your ${stage.stageName} task for Order #${ctx.order.orderNumber} has been reassigned.`,
        priority: "medium",
        eventKey: `task_reassigned:${stageProgressId}:${previousEmployeeId}`,
        orderId: stage.orderId,
      });
    }
    // Admins see the change too.
    const admins = await adminRecipientIds(businessId);
    for (const uid of admins) {
      targets.push({
        userId: uid,
        type: "order_reassigned",
        title: "Task Reassigned",
        message: `${stage.stageName} for Order #${ctx.order.orderNumber} was reassigned.`,
        priority: "medium",
        eventKey: `task_reassigned_admin:${stageProgressId}:${newEmployeeId ?? "none"}`,
        orderId: stage.orderId,
      });
    }
  }

  await createNotifications(businessId, targets);
}

/* ------------------------------------------------------------------ */
/* Order events                                                        */
/* ------------------------------------------------------------------ */

export async function onDeliveryDateChanged(
  businessId: string,
  orderId: string,
  oldDate: string,
  newDate: string,
): Promise<void> {
  const ctx = await orderContext(businessId, orderId);
  if (!ctx) return;
  const admins = await adminRecipientIds(businessId);

  // Future reminders are recalculated by the scheduler using the new date;
  // historical alerts stay untouched (event_key contains the old date, so
  // stale ones can never regenerate). Notify admins of the change itself.
  await createNotifications(
    businessId,
    admins.map((uid) => ({
      userId: uid,
      type: "due_today" as const,
      title: "Delivery Date Changed",
      message: `Order #${ctx.order.orderNumber} delivery moved from ${oldDate} to ${newDate}. Future reminders have been rescheduled.`,
      priority: "medium" as const,
      eventKey: `delivery_changed:${orderId}:${newDate}`,
      orderId,
      metadata: { oldDate, newDate },
    })),
  );
}

export async function onOrderStatusChanged(
  businessId: string,
  orderId: string,
  status: string,
): Promise<void> {
  const ctx = await orderContext(businessId, orderId);
  if (!ctx) return;
  const admins = await adminRecipientIds(businessId);

  if (status === "delivered" || status === "cancelled") {
    // Deadline alerts stop for this order (scheduler excludes closed orders);
    // mark the closure for the record.
    await createNotifications(
      businessId,
      admins.map((uid) => ({
        userId: uid,
        type: "stage_completed" as const,
        title: status === "delivered" ? "Order Delivered" : "Order Cancelled",
        message:
          status === "delivered"
            ? `Order #${ctx.order.orderNumber} for ${ctx.customerName} has been delivered. Delivery reminders are now stopped.`
            : `Order #${ctx.order.orderNumber} has been cancelled. Delivery reminders are now stopped.`,
        priority: "low" as const,
        eventKey: `order_${status}:${orderId}`,
        orderId,
      })),
    );
    return;
  }

  if (status === "ready_for_delivery") {
    await createNotifications(
      businessId,
      admins.map((uid) => ({
        userId: uid,
        type: "ready_for_delivery" as const,
        title: "Ready for Delivery",
        message: `Order #${ctx.order.orderNumber} for ${ctx.customerName} is marked ready for delivery.`,
        priority: "high" as const,
        eventKey: `ready_for_delivery:${orderId}`,
        orderId,
      })),
    );
  }
}

void inArray;
