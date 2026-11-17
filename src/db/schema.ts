import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  integer,
  numeric,
  boolean,
  date,
  time,
  timestamp,
  jsonb,
  customType,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** Postgres bytea mapped to Buffer — used for DB-backed file storage. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
  toDriver: (value) => value,
  fromDriver: (value: unknown) =>
    Buffer.isBuffer(value) ? value : Buffer.from(value as Uint8Array),
});

/* ---------------------------------------------------------------------------
 * Enums
 * ------------------------------------------------------------------------- */

export const userRoleEnum = pgEnum("user_role", [
  "super_admin",
  "manager",
  "production_staff",
  "billing_staff",
]);

export const productionCategoryEnum = pgEnum("production_category", [
  "cutting",
  "designing",
  "embroidery",
  "stone_crystals",
  "hand_work",
  "stitching",
]);

export const orderPriorityEnum = pgEnum("order_priority", [
  "normal",
  "high",
  "urgent",
  "critical",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "new",
  "in_production",
  "on_hold",
  "finished",
  "ready_for_delivery",
  "delivered",
  "cancelled",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "partial",
  "paid",
  "refunded",
]);

export const stageStatusEnum = pgEnum("stage_status", [
  "not_started",
  "in_progress",
  "on_hold",
  "completed",
  "skipped",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  // Delivery deadline schedule (Module 4.A)
  "early_reminder",
  "upcoming_deadline",
  "warning",
  "urgent",
  "critical",
  "due_today",
  "overdue",
  // Production events (Module 4.E/F)
  "task_assigned",
  "stage_ready",
  "task_reminder",
  "stage_overdue",
  "stage_completed",
  "production_delay",
  "hold_alert",
  "employee_overload",
  "ready_for_delivery",
  "order_reassigned",
  // Other
  "daily_summary",
  "payment_due",
]);

export const notificationPriorityEnum = pgEnum("notification_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const deliveryChannelEnum = pgEnum("delivery_channel", [
  "in_app",
  "push",
  "email",
  "whatsapp",
]);

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "pending",
  "sent",
  "failed",
  "skipped",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "issued",
  "partial",
  "paid",
  "cancelled",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "upi",
  "card",
  "bank_transfer",
  "cheque",
  "other",
]);

export const attachmentKindEnum = pgEnum("attachment_kind", [
  "reference_image",
  "work_image",
  "document",
]);

/* ---------------------------------------------------------------------------
 * Tenancy & identity
 * ------------------------------------------------------------------------- */

export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  currency: text("currency").notNull().default("INR"),
  // UAE/GCC Tax Registration Number (VAT) — printed on invoices.
  trn: text("trn"),
  // Path of the uploaded business logo (served via /api/business/logo).
  logoPath: text("logo_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const businessSettings = pgTable("business_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .unique()
    .references(() => businesses.id, { onDelete: "cascade" }),
  // Order / invoice numbering
  orderNextNumber: integer("order_next_number").notNull().default(1001),
  invoiceNextNumber: integer("invoice_next_number").notNull().default(1001),
  invoicePrefix: text("invoice_prefix").notNull().default("INV"),
  // Billing
  taxLabel: text("tax_label").notNull().default("GST"),
  taxRate: numeric("tax_rate", { precision: 6, scale: 3 }).notNull().default("18"),
  // Notification schedule
  dailySummaryEnabled: boolean("daily_summary_enabled").notNull().default(true),
  dailySummaryTime: time("daily_summary_time").notNull().default("09:00"),
  // Email delivery of the daily summary + critical alerts (requires a
  // configured email provider — see EMAIL_* env vars).
  emailSummaryEnabled: boolean("email_summary_enabled").notNull().default(false),
  // Email provider configuration (Modules 4.G/H). Saved in-app by the admin;
  // EMAIL_* environment variables override these when set.
  emailProvider: text("email_provider").notNull().default("none"), // none | resend | smtp
  emailFrom: text("email_from"),
  emailApiKey: text("email_api_key"), // Resend
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port").default(587),
  smtpSecure: boolean("smtp_secure").default(false),
  smtpUser: text("smtp_user"),
  smtpPassword: text("smtp_password"),
  // Days-before-delivery thresholds at which deadline reminders fire (JSON int array)
  reminderDays: jsonb("reminder_days").notNull().default([7, 5, 3, 2, 1]),
  overdueAlertsEnabled: boolean("overdue_alerts_enabled").notNull().default(true),
  delayWarningsEnabled: boolean("delay_warnings_enabled").notNull().default(true),
  holdAlertDays: integer("hold_alert_days").notNull().default(3),
  maxUrgentTasksPerEmployee: integer("max_urgent_tasks_per_employee").notNull().default(3),
  notificationRetentionDays: integer("notification_retention_days").notNull().default(365),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    // Push / notification prefs that are per-device are in push_subscriptions.
    quietHoursStart: time("quiet_hours_start"),
    quietHoursEnd: time("quiet_hours_end"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("user_profiles_email_key").on(t.email)],
);

export const businessMemberships = pgTable(
  "business_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    role: userRoleEnum("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("business_memberships_unique").on(t.businessId, t.userId),
    index("business_memberships_user_idx").on(t.userId),
  ],
);

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    // Optional login link (an employee may be a production staff user)
    userId: uuid("user_id").references(() => userProfiles.id, { onDelete: "set null" }),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    email: text("email"),
    // Production categories this employee can work in (JSON array of enum values)
    categories: jsonb("categories").notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("employees_business_idx").on(t.businessId)],
);

/* ---------------------------------------------------------------------------
 * Customers & measurements
 * ------------------------------------------------------------------------- */

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    mobile: text("mobile").notNull(),
    altMobile: text("alt_mobile"),
    email: text("email"),
    address: text("address"),
    // Customer Tax Registration Number (UAE/GCC VAT) — shown on invoices.
    trn: text("trn"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("customers_business_idx").on(t.businessId),
    index("customers_mobile_idx").on(t.businessId, t.mobile),
  ],
);

export const customerMeasurements = pgTable(
  "customer_measurements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    garmentType: text("garment_type").notNull(),
    label: text("label"),
    // Free-form measurement bag: { chest: "38", waist: "32", ... }
    values: jsonb("values").notNull().default({}),
    notes: text("notes"),
    recordedBy: uuid("recorded_by").references(() => userProfiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("customer_measurements_customer_idx").on(t.customerId)],
);

/* ---------------------------------------------------------------------------
 * Orders & production
 * ------------------------------------------------------------------------- */

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    orderNumber: text("order_number").notNull(), // ORD-1025
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    status: orderStatusEnum("status").notNull().default("new"),
    priority: orderPriorityEnum("priority").notNull().default("normal"),
    orderDate: date("order_date").notNull(),
    deliveryDate: date("delivery_date").notNull(),
    deliveryTime: time("delivery_time"),
    // Denormalised snapshot of "where is this order in production".
    // For multi-item orders this is the bottleneck (least advanced) stage.
    currentStageKey: text("current_stage_key").notNull().default("order_created"),
    progressPercent: integer("progress_percent").notNull().default(0),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
    designInstructions: text("design_instructions"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => userProfiles.id, { onDelete: "set null" }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_number_unique").on(t.businessId, t.orderNumber),
    index("orders_business_idx").on(t.businessId),
    index("orders_customer_idx").on(t.customerId),
    index("orders_delivery_idx").on(t.businessId, t.deliveryDate),
    index("orders_status_idx").on(t.businessId, t.status),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    garmentCategory: text("garment_category").notNull(),
    garmentType: text("garment_type").notNull(),
    quantity: integer("quantity").notNull().default(1),
    fabricDetails: text("fabric_details"),
    color: text("color"),
    measurements: jsonb("measurements").notNull().default({}),
    measurementId: uuid("measurement_id").references(() => customerMeasurements.id, {
      onDelete: "set null",
    }),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    // Per-item production snapshot (multi-garment orders track independently)
    currentStageKey: text("current_stage_key").notNull().default("order_created"),
    progressPercent: integer("progress_percent").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const productionStageDefinitions = pgTable(
  "production_stage_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    key: text("key").notNull(), // order_created, cutting, designing, embroidery, stone_crystals, hand_work, stitching, finished
    name: text("name").notNull(),
    sequence: integer("sequence").notNull(),
    isMandatory: boolean("is_mandatory").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    defaultEstimatedHours: integer("default_estimated_hours").notNull().default(24),
  },
  (t) => [uniqueIndex("stage_defs_unique").on(t.businessId, t.key)],
);

export const orderStageProgress = pgTable(
  "order_stage_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    stageKey: text("stage_key").notNull(),
    stageName: text("stage_name").notNull(),
    sequence: integer("sequence").notNull(),
    status: stageStatusEnum("status").notNull().default("not_started"),
    assignedEmployeeId: uuid("assigned_employee_id").references(() => employees.id, {
      onDelete: "set null",
    }),
    plannedStartDate: date("planned_start_date"),
    plannedCompletionDate: date("planned_completion_date"),
    actualStartedAt: timestamp("actual_started_at", { withTimezone: true }),
    actualCompletedAt: timestamp("actual_completed_at", { withTimezone: true }),
    estimatedDurationHours: integer("estimated_duration_hours"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("stage_progress_unique").on(t.orderItemId, t.stageKey),
    index("stage_progress_order_idx").on(t.orderId),
    index("stage_progress_employee_idx").on(t.assignedEmployeeId),
    index("stage_progress_status_idx").on(t.businessId, t.status),
  ],
);

export const stageAssignments = pgTable(
  "stage_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    stageProgressId: uuid("stage_progress_id")
      .notNull()
      .references(() => orderStageProgress.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    assignedBy: uuid("assigned_by").references(() => userProfiles.id, { onDelete: "set null" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    notes: text("notes"),
  },
  (t) => [
    index("stage_assignments_stage_idx").on(t.stageProgressId),
    index("stage_assignments_employee_idx").on(t.employeeId),
  ],
);

/* ---------------------------------------------------------------------------
 * File storage (Module 10 — files live in the database so they survive
 * serverless redeploys; used for business logos and order reference images)
 * ------------------------------------------------------------------------- */

export const storageFiles = pgTable(
  "storage_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(), // 'logo' | 'order_attachment'
    refId: uuid("ref_id"), // order id for attachments
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    // Object-storage key (S3 / Neon Storage). When set, the bytes live in
    // object storage and `data` is kept empty.
    storageKey: text("storage_key"),
    data: bytea("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("storage_files_business_idx").on(t.businessId),
    index("storage_files_ref_idx").on(t.refId),
    uniqueIndex("storage_files_logo_unique")
      .on(t.businessId, t.purpose)
      .where(sql`purpose = 'logo'`),
  ],
);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(), // order, stage, customer, invoice, ...
    entityId: uuid("entity_id"),
    orderId: uuid("order_id"),
    action: text("action").notNull(),
    message: text("message").notNull(),
    actorUserId: uuid("actor_user_id").references(() => userProfiles.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activity_logs_order_idx").on(t.orderId)],
);

export const orderAttachments = pgTable(
  "order_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id").references(() => orderItems.id, { onDelete: "cascade" }),
    stageProgressId: uuid("stage_progress_id").references(() => orderStageProgress.id, {
      onDelete: "set null",
    }),
    kind: attachmentKindEnum("kind").notNull().default("reference_image"),
    fileName: text("file_name").notNull(),
    storagePath: text("storage_path").notNull(), // relative path in storage bucket
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    uploadedBy: uuid("uploaded_by").references(() => userProfiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_attachments_order_idx").on(t.orderId)],
);

/* ---------------------------------------------------------------------------
 * Billing
 * ------------------------------------------------------------------------- */

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    invoiceNumber: text("invoice_number").notNull(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
    discountType: text("discount_type").notNull().default("percent"), // percent | flat
    discountValue: numeric("discount_value", { precision: 12, scale: 2 }).notNull().default("0"),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    additionalCharges: numeric("additional_charges", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    additionalChargesLabel: text("additional_charges_label"),
    taxLabel: text("tax_label"),
    taxRate: numeric("tax_rate", { precision: 6, scale: 3 }).notNull().default("0"),
    taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
    amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),
    balanceDue: numeric("balance_due", { precision: 12, scale: 2 }).notNull().default("0"),
    // Line items snapshot: [{ description, quantity, unitPrice, amount }]
    items: jsonb("items").notNull().default([]),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => userProfiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("invoices_number_unique").on(t.businessId, t.invoiceNumber),
    index("invoices_customer_idx").on(t.customerId),
    index("invoices_order_idx").on(t.orderId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    method: paymentMethodEnum("method").notNull().default("cash"),
    reference: text("reference"),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
    recordedBy: uuid("recorded_by").references(() => userProfiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_invoice_idx").on(t.invoiceId)],
);

/* ---------------------------------------------------------------------------
 * Notifications (Module 4/5 tables)
 * ------------------------------------------------------------------------- */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    recipientUserId: uuid("recipient_user_id").references(() => userProfiles.id, {
      onDelete: "cascade",
    }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    priority: notificationPriorityEnum("priority").notNull().default("medium"),
    // Idempotency key. Deadline reminders:
    //   tenant:order:recipient:type:deliveryDate[:overdueDate]
    eventKey: text("event_key").notNull(),
    isBroadcast: boolean("is_broadcast").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("notifications_event_key_unique").on(t.businessId, t.eventKey, t.recipientUserId),
    index("notifications_recipient_idx").on(t.recipientUserId),
    index("notifications_order_idx").on(t.orderId),
    index("notifications_created_idx").on(t.businessId, t.createdAt),
  ],
);

export const notificationUserState = pgTable(
  "notification_user_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("notification_user_state_unique").on(t.notificationId, t.userId),
    index("notification_user_state_user_idx").on(t.userId),
  ],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    notificationType: notificationTypeEnum("notification_type").notNull(),
    inAppEnabled: boolean("in_app_enabled").notNull().default(true),
    pushEnabled: boolean("push_enabled").notNull().default(true),
    emailEnabled: boolean("email_enabled").notNull().default(false),
    whatsappEnabled: boolean("whatsapp_enabled").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("notification_preferences_unique").on(t.userId, t.businessId, t.notificationType),
  ],
);

export const notificationRules = pgTable(
  "notification_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    ruleType: text("rule_type").notNull(), // deadline_reminder | overdue_alert | delay_warning | daily_summary | payment_due
    threshold: integer("threshold"), // e.g. 7 days before delivery; null for non-day rules
    priority: notificationPriorityEnum("priority").notNull().default("medium"),
    enabled: boolean("enabled").notNull().default(true),
    // Who receives it: admins | managers | assigned_employee | everyone
    recipientScope: text("recipient_scope").notNull().default("admins"),
    scheduleSettings: jsonb("schedule_settings").notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("notification_rules_unique").on(t.businessId, t.ruleType, t.threshold),
  ],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    deviceIdentifier: text("device_identifier").notNull(),
    endpoint: text("endpoint").notNull().unique(),
    // { keys: { p256dh, auth }, ... } — named per spec "encrypted_subscription_details";
    // stores the Web Push subscription payload (transport is HTTPS; optional app-level
    // encryption hook provided in notifications/push.ts).
    encryptedSubscriptionDetails: jsonb("encrypted_subscription_details").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [
    index("push_subscriptions_user_idx").on(t.userId),
    uniqueIndex("push_subscriptions_device_unique").on(t.userId, t.deviceIdentifier),
  ],
);

export const notificationDeliveryAttempts = pgTable(
  "notification_delivery_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    channel: deliveryChannelEnum("channel").notNull(),
    deliveryStatus: deliveryStatusEnum("delivery_status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    errorDetails: text("error_details"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("delivery_attempts_notification_idx").on(t.notificationId),
  ],
);

/* ---------------------------------------------------------------------------
 * Type helpers
 * ------------------------------------------------------------------------- */

export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type BusinessMembership = typeof businessMemberships.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type CustomerMeasurement = typeof customerMeasurements.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type OrderStageProgress = typeof orderStageProgress.$inferSelect;
export type NewOrderStageProgress = typeof orderStageProgress.$inferInsert;
export type StageAssignment = typeof stageAssignments.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationUserState = typeof notificationUserState.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NotificationRule = typeof notificationRules.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type OrderAttachment = typeof orderAttachments.$inferSelect;

// Shared literal unions for app code
export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type OrderPriority = (typeof orderPriorityEnum.enumValues)[number];
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
export type StageStatus = (typeof stageStatusEnum.enumValues)[number];
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
export type NotificationPriority = (typeof notificationPriorityEnum.enumValues)[number];

/** Canonical ordered production workflow (keys used across app + seed). */
export const STAGE_ORDER = [
  "order_created",
  "cutting",
  "designing",
  "embroidery",
  "stone_crystals",
  "hand_work",
  "stitching",
  "finished",
] as const;
export type StageKey = (typeof STAGE_ORDER)[number];

export const STAGE_LABELS: Record<StageKey, string> = {
  order_created: "Bill / Order Created",
  cutting: "Cutting",
  designing: "Designing",
  embroidery: "Embroidery",
  stone_crystals: "Stone / Crystals",
  hand_work: "Hand Work",
  stitching: "Stitching",
  finished: "Finished",
};

/** Stages that are optional — admins may skip them per order. */
export const OPTIONAL_STAGES: StageKey[] = ["designing", "embroidery", "stone_crystals", "hand_work"];

// Suppress unused import warning when sql helpers are added later
void sql;
