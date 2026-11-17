-- S3-compatible object storage support: when storage_key is set the bytes
-- live in S3 (Neon Storage) and `data` stays empty.
ALTER TABLE storage_files
  ADD COLUMN IF NOT EXISTS storage_key text;
