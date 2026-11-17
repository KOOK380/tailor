-- DB-backed file storage (Module 10): logos and order reference images are
-- stored in Postgres so they survive serverless redeploys (Neon / Supabase).
CREATE TABLE IF NOT EXISTS storage_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  ref_id uuid,
  file_name text NOT NULL,
  mime_type text,
  size_bytes integer,
  data bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS storage_files_business_idx ON storage_files (business_id);
CREATE INDEX IF NOT EXISTS storage_files_ref_idx ON storage_files (ref_id);
CREATE UNIQUE INDEX IF NOT EXISTS storage_files_logo_unique
  ON storage_files (business_id, purpose) WHERE purpose = 'logo';
