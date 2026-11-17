"use server";

import { revalidatePath } from "next/cache";
import { eq, and, ilike, or, desc, count } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  customers,
  customerMeasurements,
  orders,
  invoices,
  payments,
} from "@/db/schema";
import { requirePermission, requireSession } from "@/lib/auth";
import { customerSchema, measurementSchema, type CustomerInput } from "@/lib/validations";

export async function listCustomers(search?: string) {
  const session = await requireSession();
  const db = getDb();
  const conds = [eq(customers.businessId, session.businessId)];
  if (search) {
    const pattern = `%${search}%`;
    conds.push(
      or(ilike(customers.fullName, pattern), ilike(customers.mobile, pattern))!,
    );
  }
  return db
    .select()
    .from(customers)
    .where(and(...conds))
    .orderBy(desc(customers.createdAt))
    .limit(200);
}

export async function getCustomer(id: string) {
  const session = await requireSession();
  const db = getDb();
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.businessId, session.businessId)))
    .limit(1);
  return customer ?? null;
}

export type CustomerActionResult = { ok?: boolean; error?: string; id?: string };

export async function createCustomer(input: CustomerInput): Promise<CustomerActionResult> {
  const session = await requirePermission("manageCustomers");
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const db = getDb();
  const [customer] = await db
    .insert(customers)
    .values({
      businessId: session.businessId,
      fullName: parsed.data.fullName,
      mobile: parsed.data.mobile,
      altMobile: parsed.data.altMobile || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      trn: parsed.data.trn || null,
      notes: parsed.data.notes || null,
    })
    .returning();
  revalidatePath("/customers");
  return { ok: true, id: customer.id };
}

export async function updateCustomer(
  id: string,
  input: CustomerInput,
): Promise<CustomerActionResult> {
  const session = await requirePermission("manageCustomers");
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const db = getDb();
  await db
    .update(customers)
    .set({
      fullName: parsed.data.fullName,
      mobile: parsed.data.mobile,
      altMobile: parsed.data.altMobile || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      trn: parsed.data.trn || null,
      notes: parsed.data.notes || null,
      updatedAt: new Date(),
    })
    .where(and(eq(customers.id, id), eq(customers.businessId, session.businessId)));
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { ok: true };
}

export async function addMeasurement(customerId: string, input: unknown) {
  const session = await requirePermission("manageCustomers");
  const parsed = measurementSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const db = getDb();
  await db.insert(customerMeasurements).values({
    businessId: session.businessId,
    customerId,
    garmentType: parsed.data.garmentType,
    label: parsed.data.label || null,
    values: parsed.data.values,
    notes: parsed.data.notes || null,
    recordedBy: session.userId,
  });
  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}

export async function getCustomerHistory(id: string) {
  const session = await requireSession();
  const db = getDb();
  const measurements = await db
    .select()
    .from(customerMeasurements)
    .where(
      and(
        eq(customerMeasurements.customerId, id),
        eq(customerMeasurements.businessId, session.businessId),
      ),
    )
    .orderBy(desc(customerMeasurements.createdAt));

  const customerOrders = await db
    .select()
    .from(orders)
    .where(
      and(eq(orders.customerId, id), eq(orders.businessId, session.businessId)),
    )
    .orderBy(desc(orders.createdAt));

  const customerInvoices = await db
    .select()
    .from(invoices)
    .where(
      and(eq(invoices.customerId, id), eq(invoices.businessId, session.businessId)),
    )
    .orderBy(desc(invoices.createdAt));

  const customerPayments = await db
    .select()
    .from(payments)
    .where(
      and(eq(payments.customerId, id), eq(payments.businessId, session.businessId)),
    )
    .orderBy(desc(payments.paidAt));

  return { measurements, orders: customerOrders, invoices: customerInvoices, payments: customerPayments };
}

/** Quick customer lookup used by the New Order wizard (Module 8).
 *  Instant type-ahead: matches names from the first character and phone
 *  digits ignoring spaces/+/dashes. Empty query returns the first customers
 *  so the list is visible immediately. */
export async function lookupByMobile(mobile: string) {
  const session = await requirePermission("manageOrders");
  const db = getDb();
  const digits = (mobile ?? "").replace(/\D/g, "");
  const nameQuery = (mobile ?? "").trim().toLowerCase();

  const all = await db
    .select()
    .from(customers)
    .where(eq(customers.businessId, session.businessId))
    .orderBy(customers.fullName)
    .limit(500);

  // No query → no results (the list only appears once the user types).
  if (!digits && !nameQuery) return [];

  const norm = (s: string | null) => (s ?? "").replace(/\D/g, "");
  return all
    .filter((c) => {
      const byDigits = digits
        ? norm(c.mobile).includes(digits) || norm(c.altMobile).includes(digits)
        : false;
      const byName = nameQuery
        ? c.fullName.toLowerCase().includes(nameQuery)
        : false;
      return byDigits || byName;
    })
    .slice(0, 10);
}

export async function customerOrderCount() {
  const session = await requireSession();
  const db = getDb();
  const rows = await db
    .select({ customerId: orders.customerId, n: count() })
    .from(orders)
    .where(eq(orders.businessId, session.businessId))
    .groupBy(orders.customerId);
  return rows;
}

void desc;
