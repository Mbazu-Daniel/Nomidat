-- Let an organization keep its logo in the bucket.
--
-- logo_key holds the R2 object key, not a URL, so the public hostname stays a
-- deployment setting (R2_CUSTOM_DOMAIN, falling back to pub-<id>.r2.dev) and can
-- change without touching a row.
--
-- `logo` is left in place and still read as a fallback. It is Better Auth's own
-- column and holds a base64 data URL; switching reads to logo_key alone would
-- blank the logo of every organization that has already set one. New writes go
-- to logo_key, and the invoice prefers it, falling back to the data URL and then
-- to the drawn vector mark.
--
-- No backfill: uploading the existing data URLs into the bucket needs
-- application code, and until it exists the fallback is what keeps those logos
-- rendering.

ALTER TABLE "organization"
  ADD COLUMN IF NOT EXISTS "logo_key" text;
