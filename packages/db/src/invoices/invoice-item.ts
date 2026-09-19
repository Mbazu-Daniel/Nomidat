import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { generateId } from "../id";
import { createLineItemColumns } from "../line-item-columns";
import { product } from "../products/product";
import { invoice } from "./invoice";

export const invoiceItem = pgTable(
  "invoice_item",
  {
    id: uuid("id")
      .$defaultFn(() => generateId())
      .primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoice.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => product.id, { onDelete: "set null" }),
    description: text("description"),
    ...createLineItemColumns(),
  },
  (t) => [
    index("invoice_item_invoice_id_idx").on(t.invoiceId),
    index("invoice_item_product_id_idx").on(t.productId),
  ],
);
