"use server";

import { eq, and, inArray, gte, lte, ne, desc, asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  orders,
  orderStageProgress,
  invoices,
  payments,
  employees,
  activityLogs,
  STAGE_LABELS,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth";

export interface ReportData {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  overdueOrders: number;
  onTimeDeliveryPercent: number;
  delayedDeliveryPercent: number;
  avgProductionDays: number;
  stageWiseAvgHours: { stage: string; avgHours: number; count: number }[];
  employeeCompletion: { name: string; completed: number; inProgress: number }[];
  monthlyRevenue: { month: string; revenue: number }[];
  outstandingBalance: number;
  orderRows: {
    orderNumber: string;
    customerName: string;
    status: string;
    deliveryDate: string;
    createdAt: string;
    deliveredAt: string | null;
    progressPercent: number;
    onTime: boolean | null;
  }[];
}

export async function getReports(
  from?: string,
  to?: string,
): Promise<ReportData> {
  const session = await requirePermission("manageBilling");
  const db = getDb();
  const bid = session.businessId;

  const conds = [eq(orders.businessId, bid)];
  if (from) conds.push(gte(orders.orderDate, from));
  if (to) conds.push(lte(orders.orderDate, to));

  const rows = await db
    .select()
    .from(orders)
    .where(and(...conds))
    .orderBy(desc(orders.createdAt));

  const { customers } = await import("@/db/schema");
  const custRows = await db.select().from(customers).where(eq(customers.businessId, bid));
  const custMap = new Map(custRows.map((c) => [c.id, c.fullName]));

  const delivered = rows.filter((r) => r.status === "delivered");
  const onTime = delivered.filter(
    (r) => r.deliveredAt && r.deliveryDate >= r.deliveredAt.toISOString().slice(0, 10),
  );
  const overdue = rows.filter(
    (r) =>
      r.status !== "delivered" &&
      r.status !== "cancelled" &&
      r.deliveryDate < new Date().toISOString().slice(0, 10),
  );

  // Average production days for delivered orders.
  const prodDays = delivered
    .map((r) => {
      if (!r.deliveredAt) return null;
      const created = new Date(r.createdAt).getTime();
      const done = r.deliveredAt.getTime();
      return (done - created) / (24 * 3600 * 1000);
    })
    .filter((x): x is number => x !== null);
  const avgProductionDays = prodDays.length
    ? Math.round((prodDays.reduce((a, b) => a + b, 0) / prodDays.length) * 10) / 10
    : 0;

  // Stage-wise average hours (from completed stages).
  const stageRows = await db
    .select()
    .from(orderStageProgress)
    .where(eq(orderStageProgress.businessId, bid));
  const stageMap = new Map<string, { totalH: number; n: number }>();
  for (const s of stageRows) {
    if (s.actualStartedAt && s.actualCompletedAt) {
      const h = (s.actualCompletedAt.getTime() - s.actualStartedAt.getTime()) / 3600000;
      const entry = stageMap.get(s.stageKey) ?? { totalH: 0, n: 0 };
      entry.totalH += h;
      entry.n += 1;
      stageMap.set(s.stageKey, entry);
    }
  }
  const stageWiseAvgHours = [...stageMap.entries()].map(([key, v]) => ({
    stage: (STAGE_LABELS as Record<string, string>)[key] ?? key,
    avgHours: Math.round(v.totalH / v.n),
    count: v.n,
  }));

  // Employee completion counts.
  const empRows = await db
    .select()
    .from(employees)
    .where(eq(employees.businessId, bid));
  const employeeCompletion = [];
  for (const emp of empRows) {
    const doneStages = stageRows.filter(
      (s) => s.assignedEmployeeId === emp.id && s.status === "completed",
    ).length;
    const activeStages = stageRows.filter(
      (s) =>
        s.assignedEmployeeId === emp.id &&
        (s.status === "in_progress" || s.status === "not_started"),
    ).length;
    employeeCompletion.push({
      name: emp.fullName,
      completed: doneStages,
      inProgress: activeStages,
    });
  }

  // Monthly revenue (last 6 months from payments).
  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.businessId, bid))
    .orderBy(asc(payments.paidAt));
  const revMap = new Map<string, number>();
  for (const p of paymentRows) {
    const key = p.paidAt.toISOString().slice(0, 7);
    revMap.set(key, (revMap.get(key) ?? 0) + Number(p.amount));
  }
  const monthlyRevenue = [...revMap.entries()].map(([month, revenue]) => ({
    month,
    revenue,
  }));

  // Outstanding.
  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.businessId, bid));
  const outstandingBalance = invoiceRows.reduce((s, i) => s + Number(i.balanceDue), 0);

  return {
    totalOrders: rows.length,
    completedOrders: delivered.length,
    pendingOrders: rows.filter(
      (r) => r.status !== "delivered" && r.status !== "cancelled",
    ).length,
    overdueOrders: overdue.length,
    onTimeDeliveryPercent: delivered.length
      ? Math.round((onTime.length / delivered.length) * 100)
      : 0,
    delayedDeliveryPercent: delivered.length
      ? 100 - Math.round((onTime.length / delivered.length) * 100)
      : 0,
    avgProductionDays,
    stageWiseAvgHours,
    employeeCompletion,
    monthlyRevenue,
    outstandingBalance,
    orderRows: rows.map((r) => ({
      orderNumber: r.orderNumber,
      customerName: custMap.get(r.customerId) ?? "—",
      status: r.status,
      deliveryDate: r.deliveryDate,
      createdAt: r.createdAt.toISOString().slice(0, 10),
      deliveredAt: r.deliveredAt?.toISOString().slice(0, 10) ?? null,
      progressPercent: r.progressPercent,
      onTime:
        r.status === "delivered" && r.deliveredAt
          ? r.deliveryDate >= r.deliveredAt.toISOString().slice(0, 10)
          : null,
    })),
  };
}

/** CSV export of the order report (Module 12). */
export async function exportOrdersCsv(from?: string, to?: string): Promise<string> {
  const data = await getReports(from, to);
  const header = "Order Number,Customer,Status,Order Date,Delivery Date,Delivered At,Progress %,On Time";
  const lines = data.orderRows.map((r) =>
    [
      r.orderNumber,
      `"${r.customerName}"`,
      r.status,
      r.createdAt,
      r.deliveryDate,
      r.deliveredAt ?? "",
      r.progressPercent,
      r.onTime === null ? "" : r.onTime ? "Yes" : "No",
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

void ne;
void activityLogs;
