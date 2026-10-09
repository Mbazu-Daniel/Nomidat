-- Let the till say how the order is fulfilled, and let each line carry its own note.
--
-- fulfilment_type records dine_in / takeaway / delivery. It is what the business
-- works from: a table needs clearing, a delivery needs a driver. A till that
-- remembered it only on screen would leave every report unable to answer "how
-- many deliveries today".
--
-- Deliberately no CHECK constraint, unlike payment_method. Every surface that
-- writes an Order has its own vocabulary for this — the till sends `dine_in`,
-- the storefront has no such concept — so a constraint here would refuse
-- whichever surface used a word the database had not been told about. Migration
-- 0033 is the precedent: constraining payment_method is what made the bank
-- transfer path fail. Null elsewhere means "not applicable", not "missing".
--
-- order_item.note is per line because a single order routinely needs a different
-- instruction per dish ("extra spicy", "no onions"). One note on the order
-- cannot say which line it belongs to, so the kitchen cannot act on it.
--
-- Nullable with no backfill: existing rows predate both fields and need no
-- repair. The index is on fulfilment_type because a till filters and groups the
-- day's orders by it; order_item.note is read only alongside its own line and
-- would never be used as a filter.

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "fulfilment_type" text;

CREATE INDEX IF NOT EXISTS "orders_organization_id_fulfilment_type_idx"
  ON "orders" ("organization_id", "fulfilment_type");

ALTER TABLE "order_item"
  ADD COLUMN IF NOT EXISTS "note" text;
