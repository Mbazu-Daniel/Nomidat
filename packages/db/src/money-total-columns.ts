import { integer, text } from "drizzle-orm/pg-core";

export function createMoneyTotalColumns() {
  return {
    subtotalKobo: integer("subtotal_kobo").notNull().default(0),
    discountKobo: integer("discount_kobo").notNull().default(0),
    taxKobo: integer("tax_kobo").notNull().default(0),
    totalKobo: integer("total_kobo").notNull().default(0),
    currency: text("currency").notNull().default("NGN"),
  };
}
