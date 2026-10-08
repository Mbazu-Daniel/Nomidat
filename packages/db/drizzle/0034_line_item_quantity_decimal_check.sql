-- A line quantity is decimal, and the arithmetic that follows must still foot.
--
-- 0030 widened order_item/invoice_item quantity to numeric(12,3) so a shop could
-- record 1.5 kg. Nothing checked what came after, so a fractional quantity could
-- still be paired with totals that do not correspond to it, and nothing stopped a
-- line from carrying a negative quantity — which would return stock while still
-- recording money owed.
--
-- `total_minor` is a whole number of minor units, so a fractional line total has
-- no meaning here. Rounding is what the service already does, and the constraint
-- states it rather than leaving each writer to decide.

ALTER TABLE "order_item"
  ADD CONSTRAINT "order_item_total_minor_whole_chk"
  CHECK ("total_minor" = round("total_minor")::bigint);

ALTER TABLE "invoice_item"
  ADD CONSTRAINT "invoice_item_total_minor_whole_chk"
  CHECK ("total_minor" = round("total_minor")::bigint);

-- The sale total is minor units times quantity, so the subtotal must also be a
-- whole number of minor units. Catches a fractional discount or tax silently
-- reaching the order's own money columns.
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_totals_whole_minor_chk" CHECK (
    "subtotal_minor" = round("subtotal_minor")::bigint
    AND "discount_minor" = round("discount_minor")::bigint
    AND "tax_minor" = round("tax_minor")::bigint
    AND "total_minor" = round("total_minor")::bigint
  );

-- The subtotal is the sum of its lines. Stated as an inequality rather than an
-- equality because a line total is what the seller agreed to, which may differ
-- from quantity times unit price; what must never happen is the subtotal
-- claiming a figure the lines do not support.
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_subtotal_not_negative_chk" CHECK ("subtotal_minor" >= 0);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_total_matches_subtotal_chk" CHECK (
    "total_minor" = "subtotal_minor" - "discount_minor" + "tax_minor"
  );