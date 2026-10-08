-- A sold serial must say which sale moved it. Without this the row records only
-- that a unit was sold, never for whom, so a warranty claim or a recall cannot
-- be answered from the books.
ALTER TABLE "serial_number"
  ADD COLUMN IF NOT EXISTS "order_id" uuid;

ALTER TABLE "serial_number"
  DROP CONSTRAINT IF EXISTS "serial_number_order_id_orders_id_fk";

ALTER TABLE "serial_number"
  ADD CONSTRAINT "serial_number_order_id_orders_id_fk"
  FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "serial_number_order_id_idx" ON "serial_number" ("order_id");