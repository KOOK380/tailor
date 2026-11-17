"use server";

import { eq, and, inArray, ne, count, sql, desc, asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  orders,
  orderItems,
  orderStageProgress,
  customers,
  employees,
  invoices,
  payments,
} from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { daysRemaining } from "@/lib/deadline";

export interface DashboardStats {
  totalOrders: number;
  newOrders: number;
  inProduction: number;
  stageCounts: Record<string, number>;
  readyForDelivery: number;
  delivered: number;
  urgentOrders: number;
  overdueOrders: number;
  pendingPayments: number;
  outstandingBalance: number;
  monthlyRevenue: number;
}

export interface DeadlineGroup {
  label: string;
  key: string;
  orders: {
    id: string;
    orderNumber: string;
    customerName: string;
    garment: string;
    stage: string;
    employeeName: string | null;
    progressPercent: number;
    deliveryDate: string;
    daysLeft: number;
    priority: string;
    status: string;
  }[];
}

export async function getDashboardStats(): Promise<{
  stats: DashboardStats;
  deadlineGroups: DeadlineGroup[];
  stageDistribution: { stage: string; count: number }[];
  employeeWorkload: { name: string; active: number; urgent: number }[];
  delayedStages: {
    id: string;
    orderNumber: string;
    stageName: string;
    days: number;
    employeeName: string | null;
  }[];
  recentCompleted: { id: string; orderNumber: string; customerName: string; deliveredAt: string | null }[];
}> {
  const session = await requireSession();
  const db = getDb();
  const bid = session.businessId;

  const allOrders = await db
    .select({ order: orders, customerName: customers.fullName })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.businessId, bid));

  const active = allOrders.filter(
    (o) => o.order.status !== "delivered" && o.order.status !== "cancelled",
  );

  // Stage counts (current stage of active orders)
  const stageCounts: Record<string, number> = {};
  for (const { order } of active) {
    stageCounts[order.currentStageKey] = (stageCounts[order.currentStageKey] ?? 0) + 1;
  }

  // Deadline groups
  const groups: DeadlineGroup[] = [
    { label: "Overdue", key: "overdue", orders: [] },
    { label: "Due Today", key: "today", orders: [] },
    { label: "Due Tomorrow", key: "tomorrow", orders: [] },
    { label: "Due in 2–3 Days", key: "2-3", orders: [] },
    { label: "Due in 4–7 Days", key: "4-7", orders: [] },
    { label: "Later", key: "later", orders: [] },
  ];

  let overdueOrders = 0;
  let urgentOrders = 0;
  for (const { order, customerName } of active) {
    const days = daysRemaining(order.deliveryDate, "Asia/Kolkata");
    if (days < 0) overdueOrders += 1;
    if (order.priority === "urgent" || order.priority === "critical") urgentOrders += 1;

    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    const stages = await db
      .select()
      .from(orderStageProgress)
      .where(eq(orderStageProgress.orderId, order.id));
    const activeStage = stages
      .filter((s) => s.status !== "completed" && s.status !== "skipped")
      .sort((a, b) => a.sequence - b.sequence)[0];
    let employeeName: string | null = null;
    if (activeStage?.assignedEmployeeId) {
      const [emp] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, activeStage.assignedEmployeeId))
        .limit(1);
      employeeName = emp?.fullName ?? null;
    }

    const card = {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName,
      garment: items
        .map((i) => `${i.garmentType}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`)
        .join(", "),
      stage: order.currentStageKey.replace(/_/g, " "),
      employeeName,
      progressPercent: order.progressPercent,
      deliveryDate: order.deliveryDate,
      daysLeft: days,
      priority: order.priority,
      status: order.status,
    };

    const target =
      days < 0
        ? groups[0]
        : days === 0
          ? groups[1]
          : days === 1
            ? groups[2]
            : days <= 3
              ? groups[3]
              : days <= 7
                ? groups[4]
                : groups[5];
    target.orders.push(card);
  }
  for (const g of groups) {
    g.orders.sort((a, b) => a.daysLeft - b.daysLeft);
  }

  // Revenue (monthly, from payments)
  const paymentsRows = await db
    .select()
    .from(payments)
    .where(eq(payments.businessId, bid));
  const now = new Date();
  const monthlyRevenue = paymentsRows
    .filter((p) => {
      const d = p.paidAt;
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((s, p) => s + Number(p.amount), 0);

  // Outstanding balances
  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.businessId, bid));
  const outstandingBalance = invoiceRows.reduce((s, i) => s + Number(i.balanceDue), 0);
  const pendingPayments = invoiceRows.filter((i) => Number(i.balanceDue) > 0).length;

  // Stage distribution for chart
  const stageDistribution = Object.entries(stageCounts).map(([stage, n]) => ({
    stage: stage.replace(/_/g, " "),
    count: n,
  }));

  // Employee workload
  const empRows = await db
    .select()
    .from(employees)
    .where(and(eq(employees.businessId, bid), eq(employees.isActive, true)));
  const workload = [];
  for (const emp of empRows) {
    const assigned = stagesOf(db, bid, emp.id);
    const res = await assigned;
    workload.push({
      name: emp.fullName,
      active: res.active,
      urgent: res.urgent,
    });
  }

  // Delayed stages (in progress far past planned completion)
  const todayStr = new Date().toISOString().slice(0, 10);
  const delayedStages: {
    id: string;
    orderNumber: string;
    stageName: string;
    days: number;
    employeeName: string | null;
  }[] = [];
  const running = await db
    .select({
      stage: orderStageProgress,
      orderNumber: orders.orderNumber,
    })
    .from(orderStageProgress)
    .innerJoin(orders, eq(orderStageProgress.orderId, orders.id))
    .where(
      and(
        eq(orderStageProgress.businessId, bid),
        inArray(orderStageProgress.status, ["in_progress", "not_started"]),
        ne(orders.status, "delivered"),
      ),
    );
  for (const { stage, orderNumber } of running) {
    if (stage.plannedCompletionDate && stage.plannedCompletionDate < todayStr) {
      const days = Math.round(
        (Date.parse(todayStr) - Date.parse(stage.plannedCompletionDate)) / 86400000,
      );
      let employeeName: string | null = null;
      if (stage.assignedEmployeeId) {
        const [emp] = await db
          .select()
          .from(employees)
          .where(eq(employees.id, stage.assignedEmployeeId))
          .limit(1);
        employeeName = emp?.fullName ?? null;
      }
      delayedStages.push({
        id: stage.id,
        orderNumber,
        stageName: stage.stageName,
        days,
        employeeName,
      });
    }
  }

  // Recent completed/delivered
  const recentCompleted = allOrders
    .filter((o) => o.order.status === "delivered" || o.order.status === "ready_for_delivery")
    .sort(
      (a, b) =>
        (b.order.deliveredAt?.getTime() ?? 0) - (a.order.deliveredAt?.getTime() ?? 0),
    )
    .slice(0, 6)
    .map(({ order, customerName }) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName,
      deliveredAt: order.deliveredAt?.toISOString() ?? null,
    }));

  const stats: DashboardStats = {
    totalOrders: allOrders.length,
    newOrders: allOrders.filter((o) => o.order.status === "new").length,
    inProduction: allOrders.filter((o) => o.order.status === "in_production").length,
    stageCounts,
    readyForDelivery: allOrders.filter((o) => o.order.status === "ready_for_delivery").length,
    delivered: allOrders.filter((o) => o.order.status === "delivered").length,
    urgentOrders,
    overdueOrders,
    pendingPayments,
    outstandingBalance,
    monthlyRevenue,
  };

  return {
    stats,
    deadlineGroups: groups.filter((g) => g.orders.length > 0),
    stageDistribution,
    employeeWorkload: workload,
    delayedStages,
    recentCompleted,
  };
}

async function stagesOf(db: ReturnType<typeof getDb>, businessId: string, employeeId: string) {
  const rows = await db
    .select({
      status: orderStageProgress.status,
      priority: orders.priority,
    })
    .from(orderStageProgress)
    .innerJoin(orders, eq(orderStageProgress.orderId, orders.id))
    .where(
      and(
        eq(orderStageProgress.assignedEmployeeId, employeeId),
        inArray(orderStageProgress.status, ["not_started", "in_progress", "on_hold"]),
        ne(orders.status, "delivered"),
      ),
    );
  return {
    active: rows.length,
    urgent: rows.filter((r) => r.priority === "urgent" || r.priority === "critical").length,
  };
}

void desc;
void asc;
void count;
void sql;
