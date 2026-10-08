-- The stock ledger's two free-text columns held whatever a caller passed.
--
-- `type` drives the balance rules in `StockService`: a movement carrying an
-- unrecognised type skips the never-negative check entirely, because only the
-- three decreasing types are listed there. A typo like "outbound_shipp" would
-- therefore let a Stock Level go negative while reading as an ordinary sale.
--
-- `reference_type` is the movement's provenance — what caused it. Unconstrained,
-- the ledger cannot answer "which transfers touched this product", because a
-- typo is indistinguishable from a real category.
--
-- CHECK constraints rather than Postgres enums: an enum needs ALTER TYPE to
-- change and cannot be added to a populated column without a USING clause, so
-- every future category would be a migration on the write path. A CHECK is
-- validated once and is a drop-and-add to extend.
--
-- The reference_type list is the set the code actually writes today, read off the
-- `referenceType:` call sites in apps/api/src. It is a closed list on purpose:
-- adding a kind of movement should mean deciding what it is called, not accepting
-- any string. A movement with no cause leaves the column NULL, which passes.
--
-- NULL is permitted throughout. reference_type is optional on the row (a plain
-- count may have no cause), and a CHECK passes on NULL rather than failing.

-- Must match StockMovementType in packages/db/src/inventory/stock-movement.ts.
ALTER TABLE "stock_movement"
  ADD CONSTRAINT "stock_movement_type_chk" CHECK (
    "type" IN (
      'inbound_receive',
      'outbound_ship',
      'transfer_out',
      'transfer_in',
      'adjustment_add',
      'adjustment_remove',
      'return_in',
      'cycle_count_correction'
    )
  );

ALTER TABLE "stock_movement"
  ADD CONSTRAINT "stock_movement_reference_type_chk" CHECK (
    "reference_type" IS NULL OR "reference_type" IN (
      'order',
      'purchase_order',
      'stock_transfer',
      'stock_return',
      'adjustment',
      'cycle_count',
      'batch',
      'product',
      'serial_number'
    )
  );

-- The ledger is arithmetic: a movement records what went in or out, and the
-- balance it produced. A zero movement records nothing and is refused by the
-- service already; catching it here covers any other writer.
ALTER TABLE "stock_movement"
  ADD CONSTRAINT "stock_movement_quantity_non_zero_chk" CHECK ("quantity" <> 0);

-- A row whose new balance disagrees with its own previous balance plus the signed
-- quantity is arithmetically impossible. It means a writer computed one of the
-- three from something other than the other two, which is exactly the defect the
-- ledger exists to make visible.
ALTER TABLE "stock_movement"
  ADD CONSTRAINT "stock_movement_balance_arithmetic_chk"
  CHECK ("new_balance" = "previous_balance" + "quantity");

-- The service refuses to take a Stock Level negative for a decreasing type. The
-- constraint is the same rule for anyone who writes directly.
ALTER TABLE "stock_movement"
  ADD CONSTRAINT "stock_movement_decreasing_never_negative_chk" CHECK (
    "type" NOT IN ('outbound_ship', 'transfer_out', 'adjustment_remove')
    OR "new_balance" >= 0
  );