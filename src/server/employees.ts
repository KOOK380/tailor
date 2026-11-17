"use server";

import { revalidatePath } from "next/cache";
import { eq, and, inArray, asc, desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  employees,
  orderStageProgress,
  orders,
  customers,
  activityLogs,
} from "@/db/schema";
import { requirePermission, requireSession } from "@/lib/auth";
import { employeeSchema, type EmployeeInput } from "@/lib/validations";

export async function listEmployees() {
  const session = await requireSession();
  const db = getDb();
  return db
    .select()
    .from(employees)
    .where(eq(employees.businessId, session.businessId))
    .orderBy(asc(employees.fullName));
}

export async function createEmployee(input: unknown) {
  const session = await requirePermission("manageEmployees");
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const db = getDb();
  const [emp] = await db
    .insert(employees)
    .values({
      businessId: session.businessId,
      fullName: parsed.data.fullName,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      categories: parsed.data.categories,
      isActive: parsed.data.isActive,
    })
    .returning();
  revalidatePath("/employees");
  return { ok: true, id: emp.id };
}

export async function updateEmployee(id: string, input: unknown) {
  const session = await requirePermission("manageEmployees");
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const db = getDb();
  await db
    .update(employees)
    .set({
      fullName: parsed.data.fullName,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      categories: parsed.data.categories,
      isActive: parsed.data.isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(employees.id, id), eq(employees.businessId, session.businessId)));
  revalidatePath("/employees");
  return { ok: true };
}

/**
 * Employee personal dashboard (Module 9): assigned tasks, pending stages,
 * deadlines and completed work — scoped to the logged-in user's employee
 * record when they are production staff.
 */
export async function getMyTasks() {
  const session = await requireSession();
  const db = getDb();

  // Find the employee record linked to this user.
  const [emp] = await db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.userId, session.userId),
        eq(employees.businessId, session.businessId),
      ),
    )
    .limit(1);

  const allConds = eq(orderStageProgress.businessId, session.businessId);
  const rows = await db
    .select({
      stage: orderStageProgress,
      order: orders,
      customerName: customers.fullName,
    })
    .from(orderStageProgress)
    .innerJoin(orders, eq(orderStageProgress.orderId, orders.id))
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(allConds)
    .orderBy(asc(orderStageProgress.plannedCompletionDate), desc(orders.priority));

  const mine = emp
    ? rows.filter((r) => r.stage.assignedEmployeeId === emp.id)
    : [];
  return {
    employee: emp ?? null,
    tasks: mine.filter(
      (r) => r.stage.status === "not_started" || r.stage.status === "in_progress" || r.stage.status === "on_hold",
    ),
    completed: mine.filter((r) => r.stage.status === "completed"),
    allTasks: rows,
  };
}

export async function getEmployeeDetail(id: string) {
  const session = await requireSession();
  const db = getDb();
  const [emp] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.businessId, session.businessId)))
    .limit(1);
  if (!emp) return null;

  const rows = await db
    .select({
      stage: orderStageProgress,
      order: orders,
      customerName: customers.fullName,
    })
    .from(orderStageProgress)
    .innerJoin(orders, eq(orderStageProgress.orderId, orders.id))
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(
      and(
        eq(orderStageProgress.assignedEmployeeId, id),
        eq(orderStageProgress.businessId, session.businessId),
      ),
    )
    .orderBy(asc(orderStageProgress.plannedCompletionDate));

  return {
    employee: emp,
    tasks: rows.filter(
      (r) => r.stage.status !== "completed" && r.stage.status !== "skipped",
    ),
    completed: rows.filter((r) => r.stage.status === "completed"),
  };
}

void inArray;
void activityLogs;
