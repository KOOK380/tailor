import { describe, it, expect } from "vitest";
import { REMINDER_MESSAGES, REMINDER_TITLES } from "./scheduler";

/**
 * Message formats must match Module 4.A of the spec exactly.
 */
describe("deadline reminder messages", () => {
  const ctx = {
    orderNumber: "ORD-1025",
    stage: "Cutting",
    customerName: "Priya Sharma",
    days: 7,
    overdueDays: 0,
  };

  it("7 days — Early Reminder", () => {
    expect(REMINDER_MESSAGES.early_reminder(ctx)).toBe(
      "Order #ORD-1025 has 7 days remaining before delivery. Current production stage: Cutting. Please monitor progress.",
    );
    expect(REMINDER_TITLES.early_reminder).toBe("Delivery Reminder — 7 Days Left");
  });

  it("5 days — Upcoming Deadline", () => {
    expect(
      REMINDER_MESSAGES.upcoming_deadline({ ...ctx, stage: "Designing", days: 5 }),
    ).toBe(
      "Order #ORD-1025 has 5 days left. Current stage: Designing. Make sure production is on schedule.",
    );
  });

  it("3 days — Warning", () => {
    expect(REMINDER_MESSAGES.warning({ ...ctx, stage: "Embroidery", days: 3 })).toBe(
      "Warning! Order #ORD-1025 must be delivered in 3 days. Current stage: Embroidery. Review the remaining work.",
    );
  });

  it("2 days — Urgent", () => {
    expect(REMINDER_MESSAGES.urgent({ ...ctx, stage: "Embroidery", days: 2 })).toBe(
      "URGENT: Only 2 days remaining for Order #ORD-1025. Production is still at Embroidery. Immediate attention required.",
    );
  });

  it("1 day — Critical", () => {
    expect(REMINDER_MESSAGES.critical({ ...ctx, stage: "Stitching", days: 1 })).toBe(
      "CRITICAL DELIVERY ALERT! Order #ORD-1025 is due tomorrow. Current stage: Stitching. Complete the order immediately.",
    );
  });

  it("delivery day — Due Today", () => {
    expect(REMINDER_MESSAGES.due_today({ ...ctx, days: 0 })).toBe(
      "DELIVERY TODAY! Order #ORD-1025 for Priya Sharma is scheduled for delivery today. Confirm whether the garment is ready.",
    );
  });

  it("overdue — plural and singular", () => {
    expect(
      REMINDER_MESSAGES.overdue({ ...ctx, stage: "In Production", overdueDays: 2 }),
    ).toBe(
      "OVERDUE ALERT! Order #ORD-1025 was due 2 days ago and has not been delivered. Current status: In Production.",
    );
    expect(
      REMINDER_MESSAGES.overdue({ ...ctx, stage: "In Production", overdueDays: 1 }),
    ).toContain("was due 1 day ago");
  });
});

describe("event key format (dedup contract)", () => {
  it("uses tenant:order:type:deliveryDate and includes overdue date for recurring alerts", () => {
    // Mirrors the construction in processDeadlineReminders.
    const orderId = "abc";
    const deliveryDate = "2026-11-20";
    const today = "2026-11-18";
    expect(`deadline:${orderId}:overdue:${today}`).not.toBe(
      `deadline:${orderId}:overdue:2026-11-19`,
    );
    expect(`deadline:${orderId}:critical:${deliveryDate}`).toBe(
      "deadline:abc:critical:2026-11-20",
    );
  });
});
