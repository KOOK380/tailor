"use server";

import { revalidatePath } from "next/cache";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  invoices,
  payments,
  orders,
  orderItems,
  customers,
  businessSettings,
  activityLogs,
} from "@/db/schema";
import { requirePermission, requireSession } from "@/lib/auth";
import { computeInvoiceTotals } from "@/lib/invoice-calc";

export interface InvoiceLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateInvoiceInput {
  orderId?: string;
  customerId: string;
  issueDate: string;
  dueDate?: string;
  items: InvoiceLineInput[];
  discountType: "percent" | "flat";
  discountValue: number;
  additionalCharges: number;
  additionalChargesLabel?: string;
  notes?: string;
  advanceAmount?: number;
}

async function nextInvoiceNumber(tx: unknown, businessId: string): Promise<string> {
  const db = tx as ReturnType<typeof getDb>;
  const [settings] = await db
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.businessId, businessId))
    .limit(1);
  const next = settings?.invoiceNextNumber ?? 1001;
  await db
    .update(businessSettings)
    .set({ invoiceNextNumber: next + 1, updatedAt: new Date() })
    .where(eq(businessSettings.businessId, businessId));
  const prefix = settings?.invoicePrefix ?? "INV";
  return `${prefix}-${next}`;
}

export type InvoiceActionResult = {
  ok?: boolean;
  error?: string;
  invoiceId?: string;
  invoiceNumber?: string;
};

export async function createInvoice(input: unknown): Promise<InvoiceActionResult> {
  const session = await requirePermission("manageBilling");
  const data = input as CreateInvoiceInput;
  if (!data?.customerId || !Array.isArray(data.items) || data.items.length === 0) {
    return { error: "Customer and at least one line item are required" };
  }

  const db = getDb();
  const [settings] = await db
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.businessId, session.businessId))
    .limit(1);
  const taxRate = Number(settings?.taxRate ?? 18);
  const taxLabel = settings?.taxLabel ?? "GST";

  const totals = computeInvoiceTotals(
    data.items,
    data.discountType,
    data.discountValue,
    data.additionalCharges,
    taxRate,
  );
  const advance = data.advanceAmount ?? 0;
  const balanceDue = Math.round((totals.total - advance) * 100) / 100;

  const result = await db.transaction(async (tx) => {
    const invoiceNumber = await nextInvoiceNumber(tx, session.businessId);
    const [invoice] = await tx
      .insert(invoices)
      .values({
        businessId: session.businessId,
        invoiceNumber,
        orderId: data.orderId || null,
        customerId: data.customerId,
        status: advance >= totals.total ? "paid" : advance > 0 ? "partial" : "issued",
        issueDate: data.issueDate,
        dueDate: data.dueDate || null,
        subtotal: String(totals.subtotal),
        discountType: data.discountType,
        discountValue: String(data.discountValue),
        discountAmount: String(totals.discountAmount),
        additionalCharges: String(data.additionalCharges),
        additionalChargesLabel: data.additionalChargesLabel || null,
        taxLabel,
        taxRate: String(taxRate),
        taxAmount: String(totals.taxAmount),
        total: String(totals.total),
        amountPaid: String(advance),
        balanceDue: String(balanceDue),
        items: data.items,
        notes: data.notes || null,
        createdBy: session.userId,
      })
      .returning();

    if (advance > 0) {
      await tx.insert(payments).values({
        businessId: session.businessId,
        invoiceId: invoice.id,
        orderId: data.orderId || null,
        customerId: data.customerId,
        amount: String(advance),
        method: "cash",
        recordedBy: session.userId,
      });
    }

    await tx.insert(activityLogs).values({
      businessId: session.businessId,
      entityType: "invoice",
      entityId: invoice.id,
      orderId: data.orderId || null,
      action: "invoice_created",
      message: `Invoice ${invoiceNumber} created (total ${totals.total})`,
      actorUserId: session.userId,
    });
    return { invoiceId: invoice.id, invoiceNumber };
  });

  revalidatePath("/billing");
  return { ok: true, ...result };
}

export async function listInvoices(statusFilter?: string) {
  const session = await requirePermission("manageBilling");
  const db = getDb();
  const conds = [eq(invoices.businessId, session.businessId)];
  if (statusFilter && statusFilter !== "all") {
    conds.push(eq(invoices.status, statusFilter as never));
  }
  return db
    .select({
      invoice: invoices,
      customerName: customers.fullName,
      orderNumber: orders.orderNumber,
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .leftJoin(orders, eq(invoices.orderId, orders.id))
    .where(and(...conds))
    .orderBy(desc(invoices.createdAt))
    .limit(300);
}

export async function getInvoiceDetail(id: string) {
  const session = await requireSession();
  const db = getDb();
  const [row] = await db
    .select({
      invoice: invoices,
      customer: customers,
      orderNumber: orders.orderNumber,
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .leftJoin(orders, eq(invoices.orderId, orders.id))
    .where(and(eq(invoices.id, id), eq(invoices.businessId, session.businessId)))
    .limit(1);
  if (!row) return null;

  const invoicePayments = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, id))
    .orderBy(asc(payments.paidAt));
  return { ...row, payments: invoicePayments };
}

export interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  method: string;
  reference?: string;
  notes?: string;
  paidAt?: string;
}

export async function recordPayment(input: unknown) {
  const session = await requirePermission("manageBilling");
  const data = input as RecordPaymentInput;
  if (!data?.invoiceId || !data.amount || data.amount <= 0) {
    return { error: "Valid invoice and amount required" };
  }

  const db = getDb();
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(
      and(eq(invoices.id, data.invoiceId), eq(invoices.businessId, session.businessId)),
    )
    .limit(1);
  if (!invoice) return { error: "Invoice not found" };

  await db.transaction(async (tx) => {
    await tx.insert(payments).values({
      businessId: session.businessId,
      invoiceId: invoice.id,
      orderId: invoice.orderId,
      customerId: invoice.customerId,
      amount: String(data.amount),
      method: (data.method as never) ?? "cash",
      reference: data.reference || null,
      notes: data.notes || null,
      paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
      recordedBy: session.userId,
    });

    const paid = Number(invoice.amountPaid) + data.amount;
    const balance = Math.round((Number(invoice.total) - paid) * 100) / 100;
    await tx
      .update(invoices)
      .set({
        amountPaid: String(paid),
        balanceDue: String(Math.max(0, balance)),
        status: balance <= 0 ? "paid" : "partial",
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoice.id));

    // Update linked order payment status.
    if (invoice.orderId) {
      await tx
        .update(orders)
        .set({
          paymentStatus: balance <= 0 ? "paid" : "partial",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, invoice.orderId));
    }

    await tx.insert(activityLogs).values({
      businessId: session.businessId,
      entityType: "payment",
      orderId: invoice.orderId,
      action: "payment_recorded",
      message: `Payment of ${data.amount} recorded for ${invoice.invoiceNumber}`,
      actorUserId: session.userId,
    });
  });

  revalidatePath(`/billing/${data.invoiceId}`);
  revalidatePath("/billing");
  return { ok: true };
}

/** Pre-fill data for the invoice wizard from an order. */
export async function getInvoicePresets(orderId: string) {
  const session = await requireSession();
  const db = getDb();
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.businessId, session.businessId)))
    .limit(1);
  if (!order) return null;
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  return {
    customerId: order.customerId,
    orderId: order.id,
    items: items.map((i) => ({
      description: `${i.garmentType} ×${i.quantity}`,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
    })),
  };
}

void inArray;
