-- Give a product a picture.
--
-- image_key holds the R2 object key, not a full URL: the public hostname is a
-- deployment setting (custom domain, or the r2.dev fallback) and can change
-- without a migration, whereas storing the URL would mean rewriting every
-- product row in every organization whenever that hostname moved.
--
-- Nullable, with no backfill. Existing products simply have no picture, which
-- is the same state as a newly created product and needs no repair. The object
-- key is unique per upload, so nothing about a future replacement collides with
-- what is already stored.
--
-- No index: the column is only ever read as part of a product row the caller has
-- already selected by organization, and an index on it would never be used.

ALTER TABLE "product"
  ADD COLUMN IF NOT EXISTS "image_key" text;
