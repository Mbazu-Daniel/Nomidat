import { integer, text } from "drizzle-orm/pg-core";

export function createMoneyTotalColumns() {
  return {
    subtotalMinor: integer("subtotal_minor").notNull().default(0),
    discountMinor: integer("discount_minor").notNull().default(0),
    taxMinor: integer("tax_minor").notNull().default(0),
    totalMinor: integer("total_minor").notNull().default(0),
    currency: text("currency").notNull().default("NGN"),
  };
}
