import { integer } from "drizzle-orm/pg-core";

export function createLineItemColumns() {
  return {
    quantity: integer("quantity").notNull().default(1),
    unitPriceKobo: integer("unit_price_kobo").notNull().default(0),
    totalKobo: integer("total_kobo").notNull().default(0),
  };
}
