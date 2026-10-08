-- Batch quantity cannot live on `stock`: that table is unique per
-- product/variant/warehouse, so it has no room for one row per batch.
ALTER TABLE "stock" DROP COLUMN IF EXISTS "batch_id";

ALTER TABLE "batch"
  ADD COLUMN IF NOT EXISTS "quantity_consumed" numeric(15, 3) NOT NULL DEFAULT 0;

-- A batch can never be consumed beyond what was received.
ALTER TABLE "batch"
  DROP CONSTRAINT IF EXISTS "batch_consumed_within_received_chk";

ALTER TABLE "batch"
  ADD CONSTRAINT "batch_consumed_within_received_chk"
  CHECK ("quantity_consumed" >= 0 AND "quantity_consumed" <= "quantity_received");

-- The movement ledger is the record of a batch draw, so it must point at a
-- real batch rather than a free uuid.
ALTER TABLE "stock_movement"
  DROP CONSTRAINT IF EXISTS "stock_movement_batch_id_batch_id_fk";

ALTER TABLE "stock_movement"
  ADD CONSTRAINT "stock_movement_batch_id_batch_id_fk"
  FOREIGN KEY ("batch_id") REFERENCES "batch" ("id") ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS "stock_movement_batch_id_idx" ON "stock_movement" ("batch_id");