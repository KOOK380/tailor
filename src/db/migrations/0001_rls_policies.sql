-- Row Level Security policies (Module 15: multi-tenant isolation).
--
-- These policies key off two settings the application sets on every connection:
--   SET LOCAL app.business_id = '<uuid>'
--   SET LOCAL app.user_id     = '<uuid>'
--
-- On Supabase the same policies work unchanged when the PostgREST role
-- (authenticated) runs queries after the app calls set_config() in the same
-- transaction (see src/db/tenant.ts). Local PGlite runs as the owner role, so
-- RLS is transparent there.

-- Helper: current business id from session GUC (NULL when not set).
CREATE OR REPLACE FUNCTION app_current_business_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.business_id', true), '')::uuid
$$;

-- Helper: current user id from session GUC.
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;

-- Enable RLS on every tenant-scoped table.
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_stage_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_stage_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_user_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_delivery_attempts ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped tables: visible when the row belongs to the session business.
CREATE POLICY businesses_select ON businesses
  FOR SELECT USING (id = app_current_business_id());

CREATE POLICY business_settings_tenant ON business_settings
  FOR ALL USING (business_id = app_current_business_id())
  WITH CHECK (business_id = app_current_business_id());

CREATE POLICY business_memberships_tenant ON business_memberships
  FOR ALL USING (business_id = app_current_business_id())
  WITH CHECK (business_id = app_current_business_id());

CREATE POLICY employees_tenant ON employees
  FOR ALL USING (business_id = app_current_business_id())
  WITH CHECK (business_id = app_current_business_id());

CREATE POLICY customers_tenant ON customers
  FOR ALL USING (business_id = app_current_business_id())
  WITH CHECK (business_id = app_current_business_id());

CREATE POLICY customer_measurements_tenant ON customer_measurements
  FOR ALL USING (business_id = app_current_business_id())
  WITH CHECK (business_id = app_current_business_id());

CREATE POLICY orders_tenant ON orders
  FOR ALL USING (business_id = app_current_business_id())
  WITH CHECK (business_id = app_current_business_id());

CREATE POLICY order_items_tenant ON order_items
  FOR ALL USING (business_id = app_current_business_id())
  WITH CHECK (business_id = app_current_business_id());

CREATE POLICY stage_defs_tenant ON production_stage_definitions
  FOR ALL USING (business_id = app_current_business_id())
  WITH CHECK (business_id = app_current_business_id());

CREATE POLICY stage_progress_tenant ON order_stage_progress
  FOR ALL USING (business_id = app_current_business_id())
  WITH CHECK (business_id = app_current_business_id());

CREATE POLICY stage_assignments_tenant ON stage_assignments
  FOR ALL USING (business_id = app_current_business_id())
  WITH CHECK (business_id = app_current_business_id());

CREATE POLICY activity_logs_tenant ON activity_logs
  FOR ALL USING (business_id = app_current_business_id())
  WITH CHECK (business_id = app_current_business_id());

CREATE POLICY order_attachments_tenant ON order_attachments
  FOR ALL USING (business_id = app_current_business_id())
  WITH CHECK (business_id = app_current_business_id());

CREATE POLICY invoices_tenant ON invoices
  FOR ALL USING (business_id = app_current_business_id())
  WITH CHECK (business_id = app_current_business_id());

CREATE POLICY payments_tenant ON payments
  FOR ALL USING (business_id = app_current_business_id())
  WITH CHECK (business_id = app_current_business_id());

CREATE POLICY notification_rules_tenant ON notification_rules
  FOR ALL USING (business_id = app_current_business_id())
  WITH CHECK (business_id = app_current_business_id());

CREATE POLICY notification_delivery_attempts_tenant ON notification_delivery_attempts
  FOR ALL USING (business_id = app_current_business_id())
  WITH CHECK (business_id = app_current_business_id());

-- user_profiles: a user can read their own profile; profiles referenced by
-- their business's memberships are also readable (for assignment pickers).
CREATE POLICY user_profiles_select ON user_profiles
  FOR SELECT USING (
    id = app_current_user_id()
    OR id IN (
      SELECT user_id FROM business_memberships
      WHERE business_id = app_current_business_id()
    )
  );

-- notifications: recipient sees their own; broadcasts visible to the tenant.
CREATE POLICY notifications_tenant ON notifications
  FOR SELECT USING (
    business_id = app_current_business_id()
    AND (recipient_user_id = app_current_user_id() OR is_broadcast)
  );
CREATE POLICY notifications_insert ON notifications
  FOR INSERT WITH CHECK (business_id = app_current_business_id());

-- notification_user_state: strictly per user.
CREATE POLICY notification_user_state_tenant ON notification_user_state
  FOR ALL USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());

-- notification_preferences: per user within tenant.
CREATE POLICY notification_preferences_tenant ON notification_preferences
  FOR ALL USING (
    business_id = app_current_business_id() AND user_id = app_current_user_id()
  )
  WITH CHECK (
    business_id = app_current_business_id() AND user_id = app_current_user_id()
  );

-- push_subscriptions: per user within tenant.
CREATE POLICY push_subscriptions_tenant ON push_subscriptions
  FOR ALL USING (
    business_id = app_current_business_id() AND user_id = app_current_user_id()
  )
  WITH CHECK (
    business_id = app_current_business_id() AND user_id = app_current_user_id()
  );
