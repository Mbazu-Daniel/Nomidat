import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { generateId } from "../id";
import { createLineItemColumns } from "../line-item-columns";
import { product } from "../products/product";
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
    productName: text("product_name"),
    ...createLineItemColumns(),
  },
  (t) => [
    index("order_item_order_id_idx").on(t.orderId),
    index("order_item_product_id_idx").on(t.productId),
  ],
);
