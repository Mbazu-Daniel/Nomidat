-- A sold quantity is decimal, because a shop sells 1.5 kg rather than 1 or 2.
--
-- `stock.on_hand`, `stock_movement.quantity` and `purchase_order_item.quantity_ordered`
-- were already numeric(15,3). The line items were left as integers, so the schema
-- promised a fractional sale the sale path could not record: the DTO rejected 1.5
-- and the column would have truncated it. Both line item tables move to the same
-- type and scale as the stock they move, so a line and its stock movement stay
-- directly comparable without rounding either side.
--
-- USING with an explicit cast rather than a bare ALTER: the existing integer
-- values are exact in numeric, so no data changes, but the cast makes that
-- explicit instead of leaving it to the default.
ALTER TABLE "order_item"
  ALTER COLUMN "quantity" TYPE numeric(12, 3) USING "quantity"::numeric(12, 3);

ALTER TABLE "invoice_item"
  ALTER COLUMN "quantity" TYPE numeric(12, 3) USING "quantity"::numeric(12, 3);

-- Every line carries a positive quantity. Without this, a negative line would be
-- stored as-is and a sale could return stock while still recording money owed.
ALTER TABLE "order_item"
  ADD CONSTRAINT "order_item_quantity_positive_chk" CHECK ("quantity" > 0);

ALTER TABLE "invoice_item"
  ADD CONSTRAINT "invoice_item_quantity_positive_chk" CHECK ("quantity" > 0);

-- Money is never negative on a line: a discount may reduce a total to zero at the
-- order level, but a negative unit price or line total would mean paying the
-- customer to take the goods.
ALTER TABLE "order_item"
  ADD CONSTRAINT "order_item_unit_price_non_negative_chk" CHECK ("unit_price_minor" >= 0);

ALTER TABLE "order_item"
  ADD CONSTRAINT "order_item_total_non_negative_chk" CHECK ("total_minor" >= 0);

ALTER TABLE "invoice_item"
  ADD CONSTRAINT "invoice_item_unit_price_non_negative_chk" CHECK ("unit_price_minor" >= 0);

ALTER TABLE "invoice_item"
  ADD CONSTRAINT "invoice_item_total_non_negative_chk" CHECK ("total_minor" >= 0);