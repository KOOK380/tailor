"use server";

import { revalidatePath } from "next/cache";
import { eq, and, asc, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  orders,
  orderItems,
  orderStageProgress,
  stageAssignments,
  activityLogs,
  employees,
} from "@/db/schema";
import { requirePermission, requireSession, type SessionUser } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/* Progress calculation (Module 2)                                     */
/* ------------------------------------------------------------------ */

/**
 * Progress % = completed applicable stages / applicable stages × 100.
 * Skipped stages are excluded from both numerator and denominator.
 */
export async function recalcItemProgress(tx: unknown, orderItemId: string) {
  const db = tx as ReturnType<typeof getDb>;
  const rows = await db
    .select()
    .from(orderStageProgress)
    .where(eq(orderStageProgress.orderItemId, orderItemId));
  const applicable = rows.filter((r) => r.status !== "skipped");
  const completed = applicable.filter((r) => r.status === "completed").length;
  const pct = applicable.length ? Math.round((completed / applicable.length) * 100) : 0;

  // Current stage = least-advanced non-completed, non-skipped stage.
  const active = rows
    .filter((r) => r.status !== "skipped" && r.status !== "completed")
    .sort((a, b) => a.sequence - b.sequence)[0];
  const currentKey = active?.stageKey ?? "finished";

  await db
    .update(orderItems)
    .set({ progressPercent: pct, currentStageKey: currentKey, updatedAt: new Date() })
    .where(eq(orderItems.id, orderItemId));
  return pct;
}

/** Order-level progress = average across items; status auto-transitions. */
export async function recalcOrderProgress(tx: unknown, orderId: string) {
  const db = tx as ReturnType<typeof getDb>;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const pct = items.length
    ? Math.round(items.reduce((s, i) => s + i.progressPercent, 0) / items.length)
    : 0;

  // Bottleneck stage = least advanced among items.
  const stageKeys = items.map((i) => i.currentStageKey);
  const currentKey =
    stageKeys.includes("order_created") && stageKeys.length > 1
      ? "order_created"
      : (stageKeys[0] ?? "finished");

  const allFinished = items.length > 0 && items.every((i) => i.currentStageKey === "finished");
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

  let status = order.status;
  if (allFinished && (status === "in_production" || status === "new")) {
    status = "finished";
  }
  if (pct > 0 && status === "new") {
    status = "in_production";
  }

  await db
    .update(orders)
    .set({ progressPercent: pct, currentStageKey: currentKey, status, updatedAt: new Date() })
    .where(eq(orders.id, orderId));
  return { pct, currentKey, status };
}

/* ------------------------------------------------------------------ */
/* Stage actions                                                       */
/* ------------------------------------------------------------------ */

type StageAction = "start" | "complete" | "hold" | "resume" | "skip" | "reset";

export interface StageActionInput {
  stageId: string;
  action: StageAction;
  notes?: string;
  employeeId?: string;
}

export async function updateStage(input: unknown) {
  const session = await requirePermission("updateStages");
  const { stageId, action, notes, employeeId } = (input ?? {}) as StageActionInput;
  if (!stageId || !action) return { error: "Missing stage or action" };

  const db = getDb();
  const [stage] = await db
    .select()
    .from(orderStageProgress)
    .where(
      and(
        eq(orderStageProgress.id, stageId),
        eq(orderStageProgress.businessId, session.businessId),
      ),
    )
    .limit(1);
  if (!stage) return { error: "Stage not found" };

  // Authorization: production staff may only touch stages assigned to them.
  if (!session.permissions.skipStages) {
    const isAssigned = stage.assignedEmployeeId
      ? await isEmployeeOfUser(session, stage.assignedEmployeeId)
      : false;
    if (!isAssigned && action !== "skip") {
      return { error: "You can only update stages assigned to you" };
    }
    if (action === "skip") {
      return { error: "Only managers/admins can skip stages" };
    }
  }

  if (action === "skip") {
    // Mandatory stages cannot be skipped by anyone; optional ones can.
    // (Mandatory = order_created/finished/cutting/stitching per workflow config.)
    const mandatory = ["order_created", "cutting", "stitching", "finished"];
    if (mandatory.includes(stage.stageKey)) {
      return { error: `"${stage.stageName}" is a mandatory stage and cannot be skipped` };
    }
    if (stage.status === "completed") {
      return { error: "A completed stage cannot be skipped" };
    }
  }

  if (action === "complete" && stage.status === "skipped") {
    return { error: "Stage is skipped" };
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    const patch: Partial<typeof orderStageProgress.$inferInsert> = {
      updatedAt: now,
    };
    switch (action) {
      case "start":
        if (stage.status === "completed") throw new Error("Already completed");
        patch.status = "in_progress";
        patch.actualStartedAt = stage.actualStartedAt ?? now;
        break;
      case "complete":
        if (stage.status === "skipped") throw new Error("Stage is skipped");
        patch.status = "completed";
        patch.actualStartedAt = stage.actualStartedAt ?? now;
        patch.actualCompletedAt = now;
        if (notes) patch.notes = notes;
        break;
      case "hold":
        if (stage.status === "completed") throw new Error("Already completed");
        patch.status = "on_hold";
        if (notes) patch.notes = notes;
        break;
      case "resume":
        if (stage.status === "completed") throw new Error("Already completed");
        patch.status = "in_progress";
        break;
      case "skip":
        patch.status = "skipped";
        patch.actualCompletedAt = null;
        break;
      case "reset":
        patch.status = "not_started";
        patch.actualStartedAt = null;
        patch.actualCompletedAt = null;
        break;
    }
    if (employeeId) {
      patch.assignedEmployeeId = employeeId;
    }
    await tx
      .update(orderStageProgress)
      .set(patch)
      .where(eq(orderStageProgress.id, stageId));

    // Track assignment history.
    if (employeeId) {
      await tx
        .update(stageAssignments)
        .set({ releasedAt: now })
        .where(
          and(
            eq(stageAssignments.stageProgressId, stageId),
            eq(stageAssignments.releasedAt, null as never),
          ),
        );
      await tx.insert(stageAssignments).values({
        businessId: session.businessId,
        stageProgressId: stageId,
        employeeId,
        assignedBy: session.userId,
        notes: notes ?? null,
      });
    }

    await tx.insert(activityLogs).values({
      businessId: session.businessId,
      entityType: "stage",
      entityId: stageId,
      orderId: stage.orderId,
      action: `stage_${action}`,
      message: `${stage.stageName}: ${action}${notes ? ` — ${notes}` : ""}`,
      actorUserId: session.userId,
      metadata: { stageKey: stage.stageKey, orderItemId: stage.orderItemId },
    });

    await recalcItemProgress(tx, stage.orderItemId);
    const summary = await recalcOrderProgress(tx, stage.orderId);
    void summary;
  });

  // Phase 4 hooks (event-driven notifications).
  try {
    const events = await import("@/server/notifications/events");
    if (action === "complete") {
      await events.onStageCompleted(session.businessId, stageId);
    } else if (action === "start") {
      await events.onStageStarted(session.businessId, stageId);
    }
  } catch {
    /* notification module not wired yet */
  }

  revalidatePath(`/orders/${stage.orderId}`);
  revalidatePath("/production");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function assignStage(stageId: string, employeeId: string | null) {
  const session = await requirePermission("manageOrders");
  const db = getDb();
  const [stage] = await db
    .select()
    .from(orderStageProgress)
    .where(
      and(
        eq(orderStageProgress.id, stageId),
        eq(orderStageProgress.businessId, session.businessId),
      ),
    )
    .limit(1);
  if (!stage) return { error: "Stage not found" };

  const previousEmployeeId = stage.assignedEmployeeId;
  await db.transaction(async (tx) => {
    await tx
      .update(orderStageProgress)
      .set({ assignedEmployeeId: employeeId, updatedAt: new Date() })
      .where(eq(orderStageProgress.id, stageId));

    if (previousEmployeeId) {
      await tx
        .update(stageAssignments)
        .set({ releasedAt: new Date() })
        .where(
          and(
            eq(stageAssignments.stageProgressId, stageId),
            eq(stageAssignments.employeeId, previousEmployeeId),
            eq(stageAssignments.releasedAt, null as never),
          ),
        );
    }
    if (employeeId) {
      await tx.insert(stageAssignments).values({
        businessId: session.businessId,
        stageProgressId: stageId,
        employeeId,
        assignedBy: session.userId,
      });
    }
    await tx.insert(activityLogs).values({
      businessId: session.businessId,
      entityType: "stage",
      entityId: stageId,
      orderId: stage.orderId,
      action: "stage_assigned",
      message: employeeId
        ? `${stage.stageName} assigned to employee`
        : `${stage.stageName} unassigned`,
      actorUserId: session.userId,
      metadata: { previousEmployeeId, employeeId },
    });
  });

  try {
    const events = await import("@/server/notifications/events");
    await events.onStageAssigned(session.businessId, stageId, employeeId, previousEmployeeId);
  } catch {
    /* notification module not wired yet */
  }

  revalidatePath(`/orders/${stage.orderId}`);
  return { ok: true };
}

/** Is this stage's assigned employee linked to the current user? */
async function isEmployeeOfUser(
  session: SessionUser,
  employeeId: string,
): Promise<boolean> {
  const db = getDb();
  const [emp] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  return emp?.userId === session.userId;
}

export async function getStageTimeline(orderId: string) {
  const session = await requireSession();
  const db = getDb();
  return db
    .select()
    .from(orderStageProgress)
    .where(
      and(
        eq(orderStageProgress.orderId, orderId),
        eq(orderStageProgress.businessId, session.businessId),
      ),
    )
    .orderBy(asc(orderStageProgress.orderItemId), asc(orderStageProgress.sequence));
}

void inArray;
