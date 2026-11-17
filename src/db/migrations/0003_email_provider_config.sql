-- In-app email provider configuration (Modules 4.G/H): admins can set up
-- Resend or SMTP from the Settings page. EMAIL_* environment variables
-- override these values when present.
ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS email_provider text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS email_from text,
  ADD COLUMN IF NOT EXISTS email_api_key text,
  ADD COLUMN IF NOT EXISTS smtp_host text,
  ADD COLUMN IF NOT EXISTS smtp_port integer DEFAULT 587,
  ADD COLUMN IF NOT EXISTS smtp_secure boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS smtp_user text,
  ADD COLUMN IF NOT EXISTS smtp_password text;
