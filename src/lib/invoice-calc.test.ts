import { describe, it, expect } from "vitest";
import { computeInvoiceTotals } from "./invoice-calc";

describe("computeInvoiceTotals", () => {
  const items = [
    { description: "Blouse", quantity: 2, unitPrice: 1000 },
    { description: "Petticoat", quantity: 1, unitPrice: 500 },
  ];

  it("computes subtotal from line items", () => {
    const t = computeInvoiceTotals(items, "percent", 0, 0, 0);
    expect(t.subtotal).toBe(2500);
    expect(t.total).toBe(2500);
  });

  it("applies percent discount", () => {
    const t = computeInvoiceTotals(items, "percent", 10, 0, 0);
    expect(t.discountAmount).toBe(250);
    expect(t.total).toBe(2250);
  });

  it("applies flat discount capped at subtotal", () => {
    const t = computeInvoiceTotals(items, "flat", 3000, 0, 0);
    expect(t.discountAmount).toBe(2500);
    expect(t.total).toBe(0);
  });

  it("adds tax on discounted amount plus additional charges", () => {
    // subtotal 2500 - 10% (250) + 100 = 2350 taxable; 18% tax = 423
    const t = computeInvoiceTotals(items, "percent", 10, 100, 18);
    expect(t.taxAmount).toBe(423);
    expect(t.total).toBe(2773);
  });

  it("handles zero tax rate", () => {
    const t = computeInvoiceTotals(items, "percent", 0, 0, 0);
    expect(t.taxAmount).toBe(0);
    expect(t.total).toBe(2500);
  });

  it("rounds money to 2 decimals", () => {
    const t = computeInvoiceTotals(
      [{ description: "x", quantity: 1, unitPrice: 999.99 }],
      "percent",
      13,
      0,
      18,
    );
    // 999.99 - 130.00 = 869.99 * 1.18 = 1026.59
    expect(t.total).toBeCloseTo(1026.59, 2);
  });
});
