-- Email delivery settings (Module 4.G/H): admin toggle for emailing the daily
-- summary and critical alerts. Requires a configured email provider (env).
ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS email_summary_enabled boolean NOT NULL DEFAULT false;
