-- A sale names the variant actually sold, so an order line can be traced back to
-- the exact Stock Level it drew down.
ALTER TABLE "order_item"
  ADD COLUMN IF NOT EXISTS "variant_id" uuid;

ALTER TABLE "order_item"
  DROP CONSTRAINT IF EXISTS "order_item_variant_id_product_variant_id_fk";

ALTER TABLE "order_item"
  ADD CONSTRAINT "order_item_variant_id_product_variant_id_fk"
  FOREIGN KEY ("variant_id") REFERENCES "product_variant" ("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "order_item_variant_id_idx" ON "order_item" ("variant_id");