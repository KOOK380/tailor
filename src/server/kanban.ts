"use server";

import { revalidatePath } from "next/cache";
import { eq, and, inArray, asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  orders,
  orderItems,
  orderStageProgress,
  customers,
  activityLogs,
  STAGE_ORDER,
  STAGE_LABELS,
  type StageKey,
} from "@/db/schema";
import { requirePermission, requireSession } from "@/lib/auth";

export interface KanbanCard {
  id: string;
  orderNumber: string;
  customerName: string;
  garmentSummary: string;
  employeeName: string | null;
  deliveryDate: string;
  priority: string;
  status: string;
  progressPercent: number;
  currentStageKey: string;
}

export async function getKanbanData(): Promise<Record<string, KanbanCard[]>> {
  const session = await requireSession();
  const db = getDb();
  const rows = await db
    .select({
      order: orders,
      customerName: customers.fullName,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(
      and(
        eq(orders.businessId, session.businessId),
        inArray(orders.status, ["new", "in_production", "on_hold", "finished"]),
      ),
    );

  const columns: Record<string, KanbanCard[]> = {};
  for (const key of STAGE_ORDER) columns[key] = [];

  for (const { order, customerName } of rows) {
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    // Assigned employee of the current bottleneck stage.
    const stages = await db
      .select()
      .from(orderStageProgress)
      .where(eq(orderStageProgress.orderId, order.id));
    const active = stages
      .filter((s) => s.status !== "completed" && s.status !== "skipped")
      .sort((a, b) => a.sequence - b.sequence)[0];
    let employeeName: string | null = null;
    if (active?.assignedEmployeeId) {
      const { employees } = await import("@/db/schema");
      const [emp] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, active.assignedEmployeeId))
        .limit(1);
      employeeName = emp?.fullName ?? null;
    }

    const card: KanbanCard = {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName,
      garmentSummary: items
        .map((i) => `${i.garmentType}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`)
        .join(", "),
      employeeName,
      deliveryDate: order.deliveryDate,
      priority: order.priority,
      status: order.status,
      progressPercent: order.progressPercent,
      currentStageKey: order.currentStageKey,
    };
    const key = (columns[order.currentStageKey] ? order.currentStageKey : "order_created") as StageKey;
    columns[key].push(card);
  }

  // Sort each column by priority then delivery date.
  const priorityRank: Record<string, number> = {
    critical: 0,
    urgent: 1,
    high: 2,
    normal: 3,
  };
  for (const key of Object.keys(columns)) {
    columns[key].sort(
      (a, b) =>
        (priorityRank[a.priority] ?? 4) - (priorityRank[b.priority] ?? 4) ||
        a.deliveryDate.localeCompare(b.deliveryDate),
    );
  }
  return columns;
}

/**
 * Kanban drag-and-drop move (Module 7) — validates workflow and updates all
 * stage rows for every garment in the order:
 * - Moving forward marks intermediate stages completed (real work observed on
 *   the board), target becomes In Progress.
 * - Moving backward resets the stages after the target.
 * - Only admins/managers may move cards; mandatory stages can never be
 *   "skipped" by a drag — a drop beyond them records them as completed.
 */
export async function moveOrderToStage(
  orderId: string,
  targetStageKey: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requirePermission("manageOrders");
  if (!session.permissions.skipStages) {
    return { ok: false, error: "Only managers/admins can move orders on the board" };
  }
  if (!(STAGE_ORDER as readonly string[]).includes(targetStageKey)) {
    return { ok: false, error: "Unknown stage" };
  }

  const db = getDb();
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.businessId, session.businessId)))
    .limit(1);
  if (!order) return { ok: false, error: "Order not found" };
  if (order.status === "delivered" || order.status === "cancelled") {
    return { ok: false, error: "Order is closed" };
  }

  const targetSeq = STAGE_ORDER.indexOf(targetStageKey as StageKey) + 1;
  const now = new Date();

  await db.transaction(async (tx) => {
    const allStages = await tx
      .select()
      .from(orderStageProgress)
      .where(eq(orderStageProgress.orderId, orderId));

    for (const stage of allStages) {
      if (stage.status === "skipped") continue;
      if (stage.sequence < targetSeq && stage.status !== "completed") {
        await tx
          .update(orderStageProgress)
          .set({
            status: "completed",
            actualStartedAt: stage.actualStartedAt ?? now,
            actualCompletedAt: now,
            updatedAt: now,
          })
          .where(eq(orderStageProgress.id, stage.id));
      } else if (stage.sequence === targetSeq) {
        await tx
          .update(orderStageProgress)
          .set({
            status: "in_progress",
            actualStartedAt: stage.actualStartedAt ?? now,
            updatedAt: now,
          })
          .where(eq(orderStageProgress.id, stage.id));
      } else if (stage.sequence > targetSeq && stage.status === "completed") {
        // Dragging backwards: reopen later stages.
        await tx
          .update(orderStageProgress)
          .set({
            status: "not_started",
            actualStartedAt: null,
            actualCompletedAt: null,
            updatedAt: now,
          })
          .where(eq(orderStageProgress.id, stage.id));
      }
    }

    // Recalculate progress for each item then the order.
    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
    let sum = 0;
    for (const item of items) {
      const rows = allStages.filter((s) => s.orderItemId === item.id);
      const applicable = rows.filter((r) => r.status !== "skipped");
      const done = rows.filter((r) => r.status === "completed").length;
      const pct = applicable.length
        ? Math.round(
            ((rows.filter((r) => r.sequence < targetSeq && r.status !== "skipped").length) /
              applicable.length) *
              100,
          )
        : 0;
      sum += pct;
      await tx
        .update(orderItems)
        .set({ progressPercent: pct, currentStageKey: targetStageKey, updatedAt: now })
        .where(eq(orderItems.id, item.id));
      void done;
    }
    const pct = items.length ? Math.round(sum / items.length) : 0;
    await tx
      .update(orders)
      .set({
        currentStageKey: targetStageKey,
        progressPercent: pct,
        status: order.status === "new" && pct > 0 ? "in_production" : order.status,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId));

    await tx.insert(activityLogs).values({
      businessId: session.businessId,
      entityType: "order",
      entityId: orderId,
      orderId,
      action: "kanban_move",
      message: `${order.orderNumber} moved to ${STAGE_LABELS[targetStageKey as StageKey]} via production board`,
      actorUserId: session.userId,
      metadata: { from: order.currentStageKey, to: targetStageKey },
    });
  });

  revalidatePath("/production");
  revalidatePath("/orders");
  return { ok: true };
}

void asc;
