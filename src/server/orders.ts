"use server";

import { revalidatePath } from "next/cache";
import { eq, and, inArray, desc, asc, ne, or, ilike, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  orders,
  orderItems,
  orderStageProgress,
  productionStageDefinitions,
  businessSettings,
  customers,
  employees,
  activityLogs,
  payments,
  STAGE_ORDER,
  STAGE_LABELS,
  type OrderPriority,
  type OrderStatus,
} from "@/db/schema";
import { requirePermission, requireSession, type SessionUser } from "@/lib/auth";
import { orderSchema, type OrderInput } from "@/lib/validations";

/* ------------------------------------------------------------------ */
/* Order number generation (ORD-1001, ORD-1002, ...)                   */
/* ------------------------------------------------------------------ */

async function nextOrderNumber(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  businessId: string,
): Promise<string> {
  const [settings] = await tx
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.businessId, businessId))
    .limit(1);
  const next = settings?.orderNextNumber ?? 1001;
  await tx
    .update(businessSettings)
    .set({ orderNextNumber: next + 1, updatedAt: new Date() })
    .where(eq(businessSettings.businessId, businessId));
  return `ORD-${next}`;
}

async function logActivity(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  session: SessionUser,
  entry: {
    entityType: string;
    entityId?: string;
    orderId?: string | null;
    action: string;
    message: string;
    metadata?: Record<string, unknown>;
  },
) {
  await tx.insert(activityLogs).values({
    businessId: session.businessId,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    orderId: entry.orderId ?? null,
    action: entry.action,
    message: entry.message,
    actorUserId: session.userId,
    metadata: entry.metadata ?? {},
  });
}

/* ------------------------------------------------------------------ */
/* Create order (Module 1 & 2)                                         */
/* ------------------------------------------------------------------ */

export type ActionResult = {
  ok?: boolean;
  error?: string;
  orderId?: string;
  orderNumber?: string;
  id?: string;
};

export async function createOrder(input: unknown): Promise<ActionResult> {
  const session = await requirePermission("manageOrders");
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  if (data.deliveryDate < data.orderDate) {
    return { error: "Delivery date cannot be before the order date" };
  }

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const orderNumber = await nextOrderNumber(tx, session.businessId);

    // Stage definitions for this tenant (fallback to canonical order).
    const defs = await tx
      .select()
      .from(productionStageDefinitions)
      .where(eq(productionStageDefinitions.businessId, session.businessId))
      .orderBy(asc(productionStageDefinitions.sequence));
    const stageDefs =
      defs.length > 0
        ? defs
        : STAGE_ORDER.map((key, i) => ({
            key,
            name: STAGE_LABELS[key],
            sequence: i + 1,
            isMandatory: true,
            defaultEstimatedHours: 12,
          }));

    const [order] = await tx
      .insert(orders)
      .values({
        businessId: session.businessId,
        orderNumber,
        customerId: data.customerId,
        status: "new",
        priority: data.priority,
        orderDate: data.orderDate,
        deliveryDate: data.deliveryDate,
        deliveryTime: data.deliveryTime || null,
        designInstructions: data.designInstructions || null,
        notes: data.notes || null,
        createdBy: session.userId,
      })
      .returning();

    const itemIds: string[] = [];
    for (const item of data.items) {
      const [row] = await tx
        .insert(orderItems)
        .values({
          businessId: session.businessId,
          orderId: order.id,
          garmentCategory: item.garmentCategory || "custom",
          garmentType: item.garmentType,
          quantity: item.quantity,
          fabricDetails: item.fabricDetails || null,
          color: item.color || null,
          measurements: item.measurements,
          measurementId: item.measurementId || null,
          unitPrice: String(item.unitPrice),
          notes: item.notes || null,
        })
        .returning();
      itemIds.push(row.id);

      // Initialize stage rows for this item — skipped stages marked skipped.
      const skipSet = new Set(item.skippedStages);
      await tx.insert(orderStageProgress).values(
        stageDefs.map((def) => {
          const key = def.key;
          const skipped = skipSet.has(key) && key !== "order_created" && key !== "finished";
          return {
            businessId: session.businessId,
            orderId: order.id,
            orderItemId: row.id,
            stageKey: key,
            stageName: def.name,
            sequence: def.sequence,
            status: skipped ? ("skipped" as const) : ("not_started" as const),
            estimatedDurationHours: def.defaultEstimatedHours ?? 12,
          };
        }),
      );
    }

    // If a default employee was selected, assign them to the first active stage.
    if (data.assignedEmployeeId) {
      const firstStages = await tx
        .select()
        .from(orderStageProgress)
        .where(eq(orderStageProgress.orderId, order.id));
      for (const st of firstStages.filter(
        (s) => s.sequence === 1 || (s.sequence === 2 && s.status !== "skipped"),
      )) {
        await tx
          .update(orderStageProgress)
          .set({ assignedEmployeeId: data.assignedEmployeeId })
          .where(eq(orderStageProgress.id, st.id));
      }
    }

    await logActivity(tx, session, {
      entityType: "order",
      entityId: order.id,
      orderId: order.id,
      action: "order_created",
      message: `Order ${orderNumber} created`,
      metadata: { items: data.items.length, deliveryDate: data.deliveryDate },
    });

    // Advance payment collected with the order (optional).
    const advance = data.advancePayment;
    if (advance && advance.amount > 0) {
      await tx.insert(payments).values({
        businessId: session.businessId,
        orderId: order.id,
        customerId: data.customerId,
        amount: String(advance.amount),
        method: (advance.method as never) ?? "cash",
        reference: advance.reference || null,
        notes: "Advance payment with order",
        recordedBy: session.userId,
      });

      const orderTotal = data.items.reduce(
        (s, i) => s + i.quantity * i.unitPrice,
        0,
      );
      const status = advance.amount >= orderTotal ? "paid" : "partial";
      await tx
        .update(orders)
        .set({ paymentStatus: status, updatedAt: new Date() })
        .where(eq(orders.id, order.id));

      await logActivity(tx, session, {
        entityType: "payment",
        entityId: order.id,
        orderId: order.id,
        action: "advance_payment",
        message: `Advance payment of ${advance.amount} recorded for ${orderNumber}`,
        metadata: { amount: advance.amount, method: advance.method },
      });
    }

    return { orderId: order.id, orderNumber };
  });

  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { ok: true, ...result };
}

/* ------------------------------------------------------------------ */
/* Listing / detail                                                    */
/* ------------------------------------------------------------------ */

export interface OrderListFilters {
  q?: string;
  status?: string;
  priority?: string;
  stage?: string;
  sort?: string;
}

export async function listOrders(filters: OrderListFilters = {}) {
  const session = await requireSession();
  const db = getDb();
  const conds = [eq(orders.businessId, session.businessId)];
  if (filters.status && filters.status !== "all") {
    conds.push(eq(orders.status, filters.status as OrderStatus));
  }
  if (filters.priority && filters.priority !== "all") {
    conds.push(eq(orders.priority, filters.priority as OrderPriority));
  }
  if (filters.stage && filters.stage !== "all") {
    conds.push(eq(orders.currentStageKey, filters.stage));
  }
  if (filters.q) {
    const pattern = `%${filters.q}%`;
    conds.push(
      or(
        ilike(orders.orderNumber, pattern),
        ilike(customers.fullName, pattern),
        ilike(customers.mobile, pattern),
      )!,
    );
  }

  const query = db
    .select({
      order: orders,
      customerName: customers.fullName,
      customerMobile: customers.mobile,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(and(...conds));

  const sorted =
    filters.sort === "delivery_asc"
      ? query.orderBy(asc(orders.deliveryDate))
      : filters.sort === "priority"
        ? query.orderBy(
            sql`case orders.priority when 'critical' then 0 when 'urgent' then 1 when 'high' then 2 else 3 end`,
            asc(orders.deliveryDate),
          )
        : query.orderBy(desc(orders.createdAt));

  return sorted.limit(300);
}

export async function getOrderDetail(id: string) {
  const session = await requireSession();
  const db = getDb();
  const [row] = await db
    .select({
      order: orders,
      customer: customers,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(and(eq(orders.id, id), eq(orders.businessId, session.businessId)))
    .limit(1);
  if (!row) return null;

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, id))
    .orderBy(asc(orderItems.createdAt));

  const stages = await db
    .select()
    .from(orderStageProgress)
    .where(eq(orderStageProgress.orderId, id))
    .orderBy(asc(orderStageProgress.orderItemId), asc(orderStageProgress.sequence));

  const orderPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, id))
    .orderBy(asc(payments.paidAt));

  return { ...row, items, stages, payments: orderPayments };
}

export interface RecordOrderPaymentInput {
  orderId: string;
  amount: number;
  method: string;
  reference?: string;
  notes?: string;
}

/** Record a payment (advance / part / full) directly against an order. */
export async function recordOrderPayment(
  input: unknown,
): Promise<{ ok?: boolean; error?: string }> {
  const session = await requirePermission("manageOrders");
  const data = input as RecordOrderPaymentInput;
  if (!data?.orderId || !data.amount || data.amount <= 0) {
    return { error: "Enter a valid amount" };
  }

  const db = getDb();
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, data.orderId), eq(orders.businessId, session.businessId)))
    .limit(1);
  if (!order) return { error: "Order not found" };

  await db.transaction(async (tx) => {
    await tx.insert(payments).values({
      businessId: session.businessId,
      orderId: order.id,
      customerId: order.customerId,
      amount: String(data.amount),
      method: (data.method as never) ?? "cash",
      reference: data.reference || null,
      notes: data.notes || null,
      recordedBy: session.userId,
    });

    // Recompute payment status from total payments vs items value.
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    const orderTotal = items.reduce((s, i) => s + i.quantity * Number(i.unitPrice), 0);
    const paidRows = await tx.select().from(payments).where(eq(payments.orderId, order.id));
    const paid = paidRows.reduce((s, p) => s + Number(p.amount), 0);
    const status = paid <= 0 ? "pending" : paid >= orderTotal ? "paid" : "partial";
    await tx
      .update(orders)
      .set({ paymentStatus: status as never, updatedAt: new Date() })
      .where(eq(orders.id, order.id));

    await tx.insert(activityLogs).values({
      businessId: session.businessId,
      entityType: "payment",
      entityId: order.id,
      orderId: order.id,
      action: "payment_recorded",
      message: `Payment of ${data.amount} recorded for ${order.orderNumber}`,
      actorUserId: session.userId,
      metadata: { amount: data.amount, method: data.method },
    });
  });

  revalidatePath(`/orders/${data.orderId}`);
  return { ok: true };
}

export async function getOrderEmployees() {
  const session = await requireSession();
  const db = getDb();
  return db
    .select()
    .from(employees)
    .where(and(eq(employees.businessId, session.businessId), eq(employees.isActive, true)))
    .orderBy(asc(employees.fullName));
}

/* ------------------------------------------------------------------ */
/* Order updates (Module 17 edge cases)                                */
/* ------------------------------------------------------------------ */

export async function updateOrderDelivery(
  orderId: string,
  deliveryDate: string,
  deliveryTime?: string,
) {
  const session = await requirePermission("manageOrders");
  const db = getDb();
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.businessId, session.businessId)))
    .limit(1);
  if (!order) return { error: "Order not found" };
  if (order.status === "delivered" || order.status === "cancelled") {
    return { error: "Cannot change delivery date of a closed order" };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        deliveryDate,
        deliveryTime: deliveryTime || order.deliveryTime,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
    await logActivity(tx, session, {
      entityType: "order",
      entityId: orderId,
      orderId,
      action: "delivery_date_changed",
      message: `Delivery date changed from ${order.deliveryDate} to ${deliveryDate}`,
      metadata: { oldDate: order.deliveryDate, newDate: deliveryDate },
    });
  });

  // Phase 4 hook: reschedule future reminders (preserves notification history).
  try {
    const { onDeliveryDateChanged } = await import("@/server/notifications/events");
    await onDeliveryDateChanged(session.businessId, orderId, order.deliveryDate, deliveryDate);
  } catch {
    /* notification module not wired yet */
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { ok: true };
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const session = await requirePermission("manageOrders");
  const db = getDb();
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.businessId, session.businessId)))
    .limit(1);
  if (!order) return { error: "Order not found" };

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status,
        deliveredAt: status === "delivered" ? new Date() : order.deliveredAt,
        cancelledAt: status === "cancelled" ? new Date() : order.cancelledAt,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
    await logActivity(tx, session, {
      entityType: "order",
      entityId: orderId,
      orderId,
      action: "status_changed",
      message: `Order status changed to ${status.replace(/_/g, " ")}`,
    });
  });

  try {
    const { onOrderStatusChanged } = await import("@/server/notifications/events");
    await onOrderStatusChanged(session.businessId, orderId, status);
  } catch {
    /* notification module not wired yet */
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { ok: true };
}

export async function updateOrderPriority(orderId: string, priority: OrderPriority) {
  const session = await requirePermission("manageOrders");
  const db = getDb();
  await db
    .update(orders)
    .set({ priority, updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.businessId, session.businessId)));
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

void inArray;
void ne;
void desc;
