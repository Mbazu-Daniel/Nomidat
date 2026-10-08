import { integer, numeric } from "drizzle-orm/pg-core";

/**
 * Money is always an integer count of minor units; a quantity is not money and is
 * decimal, because a shop sells 1.5 kg of mangos rather than 1 or 2.
 *
 * The scale matches `stock.on_hand`, `stock_movement.quantity` and
 * `purchase_order_item.quantity_ordered` — all `numeric(15,3)` — so a line
 * quantity and the stock it moved are directly comparable without rounding either
 * side. Three places covers a gram-scale product; the column type is what stops a
 * fractional quantity being truncated, not the scale.
 *
 * `mode: "number"` returns a JS number, matching how the stock columns already
 * read, so nothing downstream has to know which of the two shapes it holds.
 */
export function createLineItemColumns() {
  return {
    quantity: numeric("quantity", { precision: 12, scale: 3, mode: "number" }).notNull().default(1),
    unitPriceMinor: integer("unit_price_minor").notNull().default(0),
    totalMinor: integer("total_minor").notNull().default(0),
  };
}
