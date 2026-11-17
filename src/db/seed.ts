/**
 * Demonstration data (Module 19).
 *
 * Creates the "Royal Tailors" demo business with users across all roles,
 * employees, customers, and sample orders whose delivery dates span every
 * deadline band relative to today (overdue … due today … +12 days).
 *
 *   npm run db:seed
 */
import { rawQuery, dbReady } from "./client";
import { getDb } from "./client";
import {
  businesses,
  businessSettings,
  userProfiles,
  businessMemberships,
  employees,
  customers,
  customerMeasurements,
  orders,
  orderItems,
  orderStageProgress,
  productionStageDefinitions,
  activityLogs,
} from "./schema";
import { STAGE_ORDER, STAGE_LABELS, OPTIONAL_STAGES } from "./schema";
import { hashPassword } from "../lib/auth";
import { initializeBusiness } from "../server/bootstrap";
import { eq } from "drizzle-orm";

const STAGE_DEFAULT_HOURS: Record<string, number> = {
  order_created: 2,
  cutting: 8,
  designing: 12,
  embroidery: 24,
  stone_crystals: 16,
  hand_work: 16,
  stitching: 16,
  finished: 2,
};

function dateStr(offsetDays: number): string {
  // Delivery dates are date-only strings in Asia/Kolkata; use UTC-safe math.
  const now = new Date();
  now.setUTCHours(12, 0, 0, 0);
  now.setUTCDate(now.getUTCDate() + offsetDays);
  return now.toISOString().slice(0, 10);
}

async function main() {
  await dbReady();
  const db = getDb();

  // Idempotent: skip if demo business already exists.
  const existing = await db
    .select()
    .from(businesses)
    .where(eq(businesses.slug, "royal-tailors"));
  if (existing.length > 0) {
    console.log("[seed] demo business already present — skipping");
    return;
  }

  console.log("[seed] creating Royal Tailors demo business...");
  const [business] = await db
    .insert(businesses)
    .values({
      name: "Royal Tailors",
      slug: "royal-tailors",
      phone: "+971 4 555 0123",
      email: "owner@royaltailors.ae",
      address: "Al Barsha 1, Dubai, United Arab Emirates",
      timezone: "Asia/Dubai",
      currency: "AED",
      trn: "100329045700003",
    })
    .returning();
  const businessId = business.id;

  await initializeBusiness(businessId);

  // UAE/GCC billing defaults: VAT 5% (configurable).
  await db
    .update(businessSettings)
    .set({ taxLabel: "VAT", taxRate: "5" })
    .where(eq(businessSettings.businessId, businessId));

  // Demo account passwords are documented in README.
  const PASSWORD = "Demo@1234";
  const passwordHash = await hashPassword(PASSWORD);

  const userDefs = [
    { key: "admin", fullName: "Amit Verma", email: "admin@royaltailors.in", role: "super_admin" as const, phone: "+91 98765 43210" },
    { key: "manager", fullName: "Sneha Iyer", email: "manager@royaltailors.in", role: "manager" as const, phone: "+91 98765 43211" },
    { key: "billing", fullName: "Kavita Rao", email: "billing@royaltailors.in", role: "billing_staff" as const, phone: "+91 98765 43212" },
    { key: "prod1", fullName: "Rahul Sharma", email: "rahul@royaltailors.in", role: "production_staff" as const, phone: "+91 98765 43213" },
    { key: "prod2", fullName: "Priya Patel", email: "priya@royaltailors.in", role: "production_staff" as const, phone: "+91 98765 43214" },
    { key: "prod3", fullName: "Mohammed Ali", email: "ali@royaltailors.in", role: "production_staff" as const, phone: "+91 98765 43215" },
    { key: "prod4", fullName: "Lakshmi Nair", email: "lakshmi@royaltailors.in", role: "production_staff" as const, phone: "+91 98765 43216" },
  ];

  const userIds: Record<string, string> = {};
  for (const u of userDefs) {
    const [user] = await db
      .insert(userProfiles)
      .values({ fullName: u.fullName, email: u.email, passwordHash, phone: u.phone })
      .returning();
    userIds[u.key] = user.id;
    await db.insert(businessMemberships).values({
      businessId,
      userId: user.id,
      role: u.role,
    });
  }

  // Employees (production categories from Module 9).
  const empDefs = [
    { key: "emp_rahul", fullName: "Rahul Sharma", userId: "prod1", categories: ["cutting", "stitching"] },
    { key: "emp_priya", fullName: "Priya Patel", userId: "prod2", categories: ["embroidery", "stone_crystals"] },
    { key: "emp_ali", fullName: "Mohammed Ali", userId: "prod3", categories: ["designing", "hand_work"] },
    { key: "emp_lakshmi", fullName: "Lakshmi Nair", userId: "prod4", categories: ["stitching", "hand_work", "embroidery"] },
    { key: "emp_vikram", fullName: "Vikram Singh", userId: null, categories: ["cutting", "designing"] },
  ];
  const employeeIds: Record<string, string> = {};
  for (const e of empDefs) {
    const [emp] = await db
      .insert(employees)
      .values({
        businessId,
        fullName: e.fullName,
        userId: e.userId ? userIds[e.userId] : null,
        categories: e.categories,
        phone: "+91 98765 43" + String(200 + Object.keys(employeeIds).length),
      })
      .returning();
    employeeIds[e.key] = emp.id;
  }

  // Customers.
  const custDefs = [
    { key: "priya_sharma", fullName: "Priya Sharma", mobile: "+91 90000 10001", alt: "+91 90000 20002", address: "45 Indiranagar, Bengaluru" },
    { key: "anita_desai", fullName: "Anita Desai", mobile: "+91 90000 10002", address: "12 Koramangala, Bengaluru" },
    { key: "ravi_kumar", fullName: "Ravi Kumar", mobile: "+91 90000 10003", address: "8 Whitefield, Bengaluru" },
    { key: "sunita_joshi", fullName: "Sunita Joshi", mobile: "+91 90000 10004", address: "77 Jayanagar, Bengaluru" },
    { key: "farah_khan", fullName: "Farah Khan", mobile: "+91 90000 10005", address: "3 Richmond Town, Bengaluru" },
    { key: "deepa_menon", fullName: "Deepa Menon", mobile: "+91 90000 10006", address: "19 HSR Layout, Bengaluru" },
    { key: "arjun_reddy", fullName: "Arjun Reddy", mobile: "+91 90000 10007", address: "56 Malleshwaram, Bengaluru" },
  ];
  const customerIds: Record<string, string> = {};
  for (const c of custDefs) {
    const [cust] = await db
      .insert(customers)
      .values({
        businessId,
        fullName: c.fullName,
        mobile: c.mobile,
        altMobile: c.alt ?? null,
        address: c.address,
      })
      .returning();
    customerIds[c.key] = cust.id;
  }

  // A measurement set for Priya Sharma (Designer Blouse).
  const [m1] = await db
    .insert(customerMeasurements)
    .values({
      businessId,
      customerId: customerIds.priya_sharma,
      garmentType: "Designer Blouse",
      label: "Blouse set Nov 2026",
      values: {
        bust: "38",
        waist: "32",
        shoulder: "14",
        sleeve_length: "10",
        blouse_length: "15",
        neck_depth: "7",
      },
      recordedBy: userIds.admin,
    })
    .returning();

  // Orders spanning every deadline band (relative to today).
  // status/progress/stage vary so dashboards and Kanban look realistic.
  const orderDefs = [
    {
      key: "ord_overdue",
      orderNumber: "ORD-1018",
      customer: "anita_desai",
      garment: "Salwar Kameez",
      fabric: "Cotton silk, navy blue",
      deliveryOffset: -3,
      priority: "critical" as const,
      status: "in_production" as const,
      currentStage: "stitching",
      employee: "emp_rahul",
      unitPrice: "2500",
    },
    {
      key: "ord_due_today",
      orderNumber: "ORD-1021",
      customer: "ravi_kumar",
      garment: "Nehru Jacket",
      fabric: "Raw silk, olive green",
      deliveryOffset: 0,
      priority: "urgent" as const,
      status: "in_production" as const,
      currentStage: "hand_work",
      employee: "emp_ali",
      unitPrice: "3200",
    },
    {
      key: "ord_1day",
      orderNumber: "ORD-1022",
      customer: "sunita_joshi",
      garment: "Bridal Lehenga",
      fabric: "Velvet with gold zari",
      deliveryOffset: 1,
      priority: "critical" as const,
      status: "in_production" as const,
      currentStage: "embroidery",
      employee: "emp_priya",
      unitPrice: "18500",
    },
    {
      key: "ord_2days",
      orderNumber: "ORD-1023",
      customer: "farah_khan",
      garment: "Anarkali Suit",
      fabric: "Georgette, maroon",
      deliveryOffset: 2,
      priority: "urgent" as const,
      status: "in_production" as const,
      currentStage: "stone_crystals",
      employee: "emp_priya",
      unitPrice: "5400",
    },
    {
      key: "ord_3days",
      orderNumber: "ORD-1024",
      customer: "deepa_menon",
      garment: "Silk Saree Blouse",
      fabric: "Kanchipuram silk",
      deliveryOffset: 3,
      priority: "high" as const,
      status: "in_production" as const,
      currentStage: "designing",
      employee: "emp_ali",
      unitPrice: "1800",
    },
    {
      // The spec's flagship sample order (Module 19).
      key: "ord_7days",
      orderNumber: "ORD-1025",
      customer: "priya_sharma",
      garment: "Designer Blouse",
      fabric: "Banarasi silk, royal blue with gold border",
      deliveryOffset: 7,
      priority: "urgent" as const,
      status: "in_production" as const,
      currentStage: "embroidery",
      employee: "emp_priya",
      unitPrice: "4200",
      measurementId: true,
    },
    {
      key: "ord_5days",
      orderNumber: "ORD-1026",
      customer: "arjun_reddy",
      garment: "Wedding Sherwani",
      fabric: "Brocade, cream with gold",
      deliveryOffset: 5,
      priority: "high" as const,
      status: "in_production" as const,
      currentStage: "cutting",
      employee: "emp_vikram",
      unitPrice: "12000",
    },
    {
      key: "ord_12days",
      orderNumber: "ORD-1027",
      customer: "priya_sharma",
      garment: "Kurta Set",
      fabric: "Linen, sage green",
      deliveryOffset: 12,
      priority: "normal" as const,
      status: "new" as const,
      currentStage: "order_created",
      employee: "emp_rahul",
      unitPrice: "3200",
    },
    {
      key: "ord_finished",
      orderNumber: "ORD-1015",
      customer: "ravi_kumar",
      garment: "Formal Trousers",
      fabric: "Poly-wool, charcoal",
      deliveryOffset: 2,
      priority: "normal" as const,
      status: "ready_for_delivery" as const,
      currentStage: "finished",
      employee: "emp_rahul",
      unitPrice: "1500",
    },
    {
      key: "ord_delivered",
      orderNumber: "ORD-1010",
      customer: "anita_desai",
      garment: "Cotton Kurti ×3",
      fabric: "Cotton, assorted prints",
      deliveryOffset: -8,
      priority: "normal" as const,
      status: "delivered" as const,
      currentStage: "finished",
      employee: "emp_lakshmi",
      unitPrice: "900",
    },
  ];

  for (const o of orderDefs) {
    const [order] = await db
      .insert(orders)
      .values({
        businessId,
        orderNumber: o.orderNumber,
        customerId: customerIds[o.customer],
        status: o.status,
        priority: o.priority,
        orderDate: dateStr(-7),
        deliveryDate: dateStr(o.deliveryOffset),
        deliveryTime: "17:00",
        currentStageKey: o.currentStage,
        progressPercent: 0,
        designInstructions: o.key === "ord_7days" ? "Gold thread embroidery on neckline and sleeves, matching piping." : null,
        notes: o.key === "ord_overdue" ? "Customer called twice — needs urgent completion." : null,
        createdBy: userIds.admin,
        deliveredAt: o.status === "delivered" ? new Date() : null,
      })
      .returning();

    const [item] = await db
      .insert(orderItems)
      .values({
        businessId,
        orderId: order.id,
        garmentCategory: "custom",
        garmentType: o.garment,
        quantity: o.key === "ord_delivered" ? 3 : o.key === "ord_finished" ? 2 : 1,
        fabricDetails: o.fabric,
        color: o.fabric.split(",").pop()?.trim() ?? null,
        measurements: o.key === "ord_7days" && m1 ? (m1.values as Record<string, unknown>) : {},
        measurementId: o.key === "ord_7days" && m1 ? m1.id : null,
        unitPrice: o.unitPrice,
        currentStageKey: o.currentStage,
      })
      .returning();

    // Stage rows for each workflow stage of this item.
    const targetIdx = STAGE_ORDER.indexOf(o.currentStage as (typeof STAGE_ORDER)[number]);
    const rows = STAGE_ORDER.map((key, idx) => {
      let status: "not_started" | "in_progress" | "completed" | "skipped" = "not_started";
      if (o.status === "delivered" || o.status === "ready_for_delivery") {
        status = "completed";
      } else if (idx < targetIdx) {
        // Skippable stages before the current one are marked completed in the
        // demo; embroidery/stones skipped for simpler garments.
        if (
          OPTIONAL_STAGES.includes(key) &&
          (o.garment.includes("Kurta") ||
            o.garment.includes("Trousers") ||
            o.garment.includes("Kurti"))
        ) {
          status = "skipped";
        } else {
          status = "completed";
        }
      } else if (idx === targetIdx) {
        status = o.status === "new" ? "not_started" : "in_progress";
      }
      return {
        businessId,
        orderId: order.id,
        orderItemId: item.id,
        stageKey: key,
        stageName: STAGE_LABELS[key],
        sequence: idx + 1,
        status,
        assignedEmployeeId: idx === targetIdx ? employeeIds[o.employee] : idx < targetIdx ? employeeIds[o.employee] : null,
        estimatedDurationHours: STAGE_DEFAULT_HOURS[key],
        plannedStartDate: dateStr(Math.min(idx - 1, o.deliveryOffset - 2)),
        plannedCompletionDate: dateStr(Math.min(idx + 1, o.deliveryOffset - 1)),
        actualStartedAt: status === "completed" || status === "in_progress" ? new Date() : null,
        actualCompletedAt: status === "completed" ? new Date() : null,
      };
    });
    await db.insert(orderStageProgress).values(rows);

    // Compute progress % from applicable stages.
    const applicable = rows.filter((r) => r.status !== "skipped");
    const completed = rows.filter((r) => r.status === "completed").length;
    const pct = applicable.length ? Math.round((completed / applicable.length) * 100) : 0;
    await db
      .update(orders)
      .set({ progressPercent: pct })
      .where(eq(orders.id, order.id));
    await db
      .update(orderItems)
      .set({ progressPercent: pct })
      .where(eq(orderItems.id, item.id));

    await db.insert(activityLogs).values({
      businessId,
      entityType: "order",
      entityId: order.id,
      orderId: order.id,
      action: "order_created",
      message: `Order ${o.orderNumber} created for ${o.customer.replace("_", " ")}`,
      actorUserId: userIds.admin,
    });
  }

  console.log(`[seed] business: ${business.name} (${businessId})`);
  console.log(`[seed] users: ${userDefs.length} (password: ${PASSWORD})`);
  console.log(`[seed] employees: ${empDefs.length}`);
  console.log(`[seed] customers: ${custDefs.length}`);
  console.log(`[seed] orders: ${orderDefs.length}`);
  console.log("[seed] done");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  });

// silence unused import warnings for schema pieces referenced indirectly
void rawQuery;
void businessSettings;
void productionStageDefinitions;
