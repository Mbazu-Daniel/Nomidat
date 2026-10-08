-- A purchase order's warehouse must belong to the same business as the order.
--
-- `purchase_order.warehouse_id` had no foreign key at all. Beyond letting a row
-- name a warehouse that does not exist, it let one shop name another's: receiving
-- such an order posts a Stock Movement into a warehouse this business does not
-- own, which writes inventory rows in a stranger's tenant. It is also an
-- existence oracle — passing a guessed id and observing whether the insert
-- succeeds reveals which warehouse ids are real.
--
-- The constraint is composite rather than a plain reference to warehouse.id,
-- because a single-column key would still accept any tenant's warehouse. It
-- needs a unique target on the pair, which is what the index below provides:
-- `warehouse.id` is already unique, so this constrains nothing new, it only makes
-- the pair referenceable.
--
-- ON DELETE RESTRICT, so a warehouse that stock history points at cannot be
-- deleted out from under it.

-- Already satisfied by the primary key, and present so the composite foreign key
-- below has a unique target. Concurrent creation is safe.
CREATE UNIQUE INDEX IF NOT EXISTS "warehouse_id_organization_id_uidx"
  ON "warehouse" ("id", "organization_id");

-- The rows this replaces were allowed to point anywhere; make the existing ones
-- clean first, or the constraint cannot be added. An order naming a warehouse
-- that does not exist, or one belonging to another business, is corrupt data with
-- no correct repair, so the migration stops rather than guessing.
DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT count(*) INTO bad_count
  FROM "purchase_order" po
  LEFT JOIN "warehouse" w
    ON w."id" = po."warehouse_id" AND w."organization_id" = po."organization_id"
  WHERE w."id" IS NULL;

  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'purchase_order has % row(s) whose warehouse is missing or belongs to another organization; repair them before applying this migration',
      bad_count;
  END IF;
END
$$;

ALTER TABLE "purchase_order"
  ADD CONSTRAINT "purchase_order_warehouse_organization_fk"
  FOREIGN KEY ("warehouse_id", "organization_id")
  REFERENCES "warehouse" ("id", "organization_id")
  ON DELETE restrict;