/**
 * Pure invoice totals calculation (Module 10) — kept outside "use server"
 * modules so it can be unit-tested and imported from client code too.
 */

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
}

export function computeInvoiceTotals(
  items: InvoiceLine[],
  discountType: string,
  discountValue: number,
  additionalCharges: number,
  taxRate: number,
) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discountAmount =
    discountType === "percent"
      ? Math.round(((subtotal * discountValue) / 100) * 100) / 100
      : Math.min(discountValue, subtotal);
  const taxable = subtotal - discountAmount + additionalCharges;
  const taxAmount = Math.round(taxable * taxRate) / 100;
  const total = Math.round((taxable + taxAmount) * 100) / 100;
  return { subtotal, discountAmount, taxAmount, total };
}
