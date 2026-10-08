import { index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { generateId } from "../id";
import { createLineItemColumns } from "../line-item-columns";
import { product } from "../products/product";
import { productVariant } from "../inventory/product-variant";
import { order } from "./order";

export const orderItem = pgTable(
  "order_item",
  {
    id: uuid("id")
      .$defaultFn(() => generateId())
      .primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => product.id, { onDelete: "set null" }),
    /** The variant actually sold, when the product has variants. */
    variantId: uuid("variant_id").references(() => productVariant.id, { onDelete: "set null" }),
    productName: text("product_name"),
    productSku: text("product_sku"),
    discountMinor: integer("discount_minor").notNull().default(0),
    ...createLineItemColumns(),
  },
  (t) => [
    index("order_item_order_id_idx").on(t.orderId),
    index("order_item_product_id_idx").on(t.productId),
  ],
);
