CREATE TYPE "public"."attachment_kind" AS ENUM('reference_image', 'work_image', 'document');--> statement-breakpoint
CREATE TYPE "public"."delivery_channel" AS ENUM('in_app', 'push', 'email', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'issued', 'partial', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('early_reminder', 'upcoming_deadline', 'warning', 'urgent', 'critical', 'due_today', 'overdue', 'task_assigned', 'stage_ready', 'task_reminder', 'stage_overdue', 'stage_completed', 'production_delay', 'hold_alert', 'employee_overload', 'ready_for_delivery', 'order_reassigned', 'daily_summary', 'payment_due');--> statement-breakpoint
CREATE TYPE "public"."order_priority" AS ENUM('normal', 'high', 'urgent', 'critical');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('new', 'in_production', 'on_hold', 'finished', 'ready_for_delivery', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'upi', 'card', 'bank_transfer', 'cheque', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'partial', 'paid', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."production_category" AS ENUM('cutting', 'designing', 'embroidery', 'stone_crystals', 'hand_work', 'stitching');--> statement-breakpoint
CREATE TYPE "public"."stage_status" AS ENUM('not_started', 'in_progress', 'on_hold', 'completed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'manager', 'production_staff', 'billing_staff');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"order_id" uuid,
	"action" text NOT NULL,
	"message" text NOT NULL,
	"actor_user_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"order_next_number" integer DEFAULT 1001 NOT NULL,
	"invoice_next_number" integer DEFAULT 1001 NOT NULL,
	"invoice_prefix" text DEFAULT 'INV' NOT NULL,
	"tax_label" text DEFAULT 'GST' NOT NULL,
	"tax_rate" numeric(6, 3) DEFAULT '18' NOT NULL,
	"daily_summary_enabled" boolean DEFAULT true NOT NULL,
	"daily_summary_time" time DEFAULT '09:00' NOT NULL,
	"reminder_days" jsonb DEFAULT '[7,5,3,2,1]'::jsonb NOT NULL,
	"overdue_alerts_enabled" boolean DEFAULT true NOT NULL,
	"delay_warnings_enabled" boolean DEFAULT true NOT NULL,
	"hold_alert_days" integer DEFAULT 3 NOT NULL,
	"max_urgent_tasks_per_employee" integer DEFAULT 3 NOT NULL,
	"notification_retention_days" integer DEFAULT 365 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_settings_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "customer_measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"garment_type" text NOT NULL,
	"label" text,
	"values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"mobile" text NOT NULL,
	"alt_mobile" text,
	"email" text,
	"address" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid,
	"full_name" text NOT NULL,
	"phone" text,
	"email" text,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"order_id" uuid,
	"customer_id" uuid NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_type" text DEFAULT 'percent' NOT NULL,
	"discount_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"additional_charges" numeric(12, 2) DEFAULT '0' NOT NULL,
	"additional_charges_label" text,
	"tax_label" text,
	"tax_rate" numeric(6, 3) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"balance_due" numeric(12, 2) DEFAULT '0' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_delivery_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"notification_id" uuid NOT NULL,
	"channel" "delivery_channel" NOT NULL,
	"delivery_status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"error_details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"notification_type" "notification_type" NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"email_enabled" boolean DEFAULT false NOT NULL,
	"whatsapp_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"rule_type" text NOT NULL,
	"threshold" integer,
	"priority" "notification_priority" DEFAULT 'medium' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"recipient_scope" text DEFAULT 'admins' NOT NULL,
	"schedule_settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_user_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"snoozed_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"recipient_user_id" uuid,
	"order_id" uuid,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"priority" "notification_priority" DEFAULT 'medium' NOT NULL,
	"event_key" text NOT NULL,
	"is_broadcast" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"order_item_id" uuid,
	"stage_progress_id" uuid,
	"kind" "attachment_kind" DEFAULT 'reference_image' NOT NULL,
	"file_name" text NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text,
	"size_bytes" integer,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"garment_category" text NOT NULL,
	"garment_type" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"fabric_details" text,
	"color" text,
	"measurements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"measurement_id" uuid,
	"unit_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"current_stage_key" text DEFAULT 'order_created' NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_stage_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"stage_key" text NOT NULL,
	"stage_name" text NOT NULL,
	"sequence" integer NOT NULL,
	"status" "stage_status" DEFAULT 'not_started' NOT NULL,
	"assigned_employee_id" uuid,
	"planned_start_date" date,
	"planned_completion_date" date,
	"actual_started_at" timestamp with time zone,
	"actual_completed_at" timestamp with time zone,
	"estimated_duration_hours" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"order_number" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'new' NOT NULL,
	"priority" "order_priority" DEFAULT 'normal' NOT NULL,
	"order_date" date NOT NULL,
	"delivery_date" date NOT NULL,
	"delivery_time" time,
	"current_stage_key" text DEFAULT 'order_created' NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"design_instructions" text,
	"notes" text,
	"created_by" uuid,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"invoice_id" uuid,
	"order_id" uuid,
	"customer_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" "payment_method" DEFAULT 'cash' NOT NULL,
	"reference" text,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_stage_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"sequence" integer NOT NULL,
	"is_mandatory" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"default_estimated_hours" integer DEFAULT 24 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"device_identifier" text NOT NULL,
	"endpoint" text NOT NULL,
	"encrypted_subscription_details" jsonb NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "stage_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"stage_progress_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"assigned_by" uuid,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"avatar_url" text,
	"quiet_hours_start" time,
	"quiet_hours_end" time,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_user_id_user_profiles_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_memberships" ADD CONSTRAINT "business_memberships_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_memberships" ADD CONSTRAINT "business_memberships_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_measurements" ADD CONSTRAINT "customer_measurements_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_measurements" ADD CONSTRAINT "customer_measurements_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_measurements" ADD CONSTRAINT "customer_measurements_recorded_by_user_profiles_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_attempts" ADD CONSTRAINT "notification_delivery_attempts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_attempts" ADD CONSTRAINT "notification_delivery_attempts_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_user_state" ADD CONSTRAINT "notification_user_state_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_user_state" ADD CONSTRAINT "notification_user_state_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_user_profiles_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_attachments" ADD CONSTRAINT "order_attachments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_attachments" ADD CONSTRAINT "order_attachments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_attachments" ADD CONSTRAINT "order_attachments_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_attachments" ADD CONSTRAINT "order_attachments_stage_progress_id_order_stage_progress_id_fk" FOREIGN KEY ("stage_progress_id") REFERENCES "public"."order_stage_progress"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_attachments" ADD CONSTRAINT "order_attachments_uploaded_by_user_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_measurement_id_customer_measurements_id_fk" FOREIGN KEY ("measurement_id") REFERENCES "public"."customer_measurements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stage_progress" ADD CONSTRAINT "order_stage_progress_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stage_progress" ADD CONSTRAINT "order_stage_progress_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stage_progress" ADD CONSTRAINT "order_stage_progress_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stage_progress" ADD CONSTRAINT "order_stage_progress_assigned_employee_id_employees_id_fk" FOREIGN KEY ("assigned_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_user_profiles_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_stage_definitions" ADD CONSTRAINT "production_stage_definitions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_assignments" ADD CONSTRAINT "stage_assignments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_assignments" ADD CONSTRAINT "stage_assignments_stage_progress_id_order_stage_progress_id_fk" FOREIGN KEY ("stage_progress_id") REFERENCES "public"."order_stage_progress"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_assignments" ADD CONSTRAINT "stage_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_assignments" ADD CONSTRAINT "stage_assignments_assigned_by_user_profiles_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_order_idx" ON "activity_logs" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "business_memberships_unique" ON "business_memberships" USING btree ("business_id","user_id");--> statement-breakpoint
CREATE INDEX "business_memberships_user_idx" ON "business_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "customer_measurements_customer_idx" ON "customer_measurements" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customers_business_idx" ON "customers" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "customers_mobile_idx" ON "customers" USING btree ("business_id","mobile");--> statement-breakpoint
CREATE INDEX "employees_business_idx" ON "employees" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_unique" ON "invoices" USING btree ("business_id","invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_customer_idx" ON "invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "invoices_order_idx" ON "invoices" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "delivery_attempts_notification_idx" ON "notification_delivery_attempts" USING btree ("notification_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_unique" ON "notification_preferences" USING btree ("user_id","business_id","notification_type");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_rules_unique" ON "notification_rules" USING btree ("business_id","rule_type","threshold");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_user_state_unique" ON "notification_user_state" USING btree ("notification_id","user_id");--> statement-breakpoint
CREATE INDEX "notification_user_state_user_idx" ON "notification_user_state" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_event_key_unique" ON "notifications" USING btree ("business_id","event_key","recipient_user_id");--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE INDEX "notifications_order_idx" ON "notifications" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "order_attachments_order_idx" ON "order_attachments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stage_progress_unique" ON "order_stage_progress" USING btree ("order_item_id","stage_key");--> statement-breakpoint
CREATE INDEX "stage_progress_order_idx" ON "order_stage_progress" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "stage_progress_employee_idx" ON "order_stage_progress" USING btree ("assigned_employee_id");--> statement-breakpoint
CREATE INDEX "stage_progress_status_idx" ON "order_stage_progress" USING btree ("business_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number_unique" ON "orders" USING btree ("business_id","order_number");--> statement-breakpoint
CREATE INDEX "orders_business_idx" ON "orders" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_delivery_idx" ON "orders" USING btree ("business_id","delivery_date");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "payments_invoice_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stage_defs_unique" ON "production_stage_definitions" USING btree ("business_id","key");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_device_unique" ON "push_subscriptions" USING btree ("user_id","device_identifier");--> statement-breakpoint
CREATE INDEX "stage_assignments_stage_idx" ON "stage_assignments" USING btree ("stage_progress_id");--> statement-breakpoint
CREATE INDEX "stage_assignments_employee_idx" ON "stage_assignments" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_email_key" ON "user_profiles" USING btree ("email");