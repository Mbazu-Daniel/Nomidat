import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createMoneyTotalColumns } from "../money-total-columns";
import { contact } from "../contacts/contact";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { order } from "../orders/order";
import { product } from "../products/product";
import { productVariant } from "./product-variant";

export const RETURN_STATUSES = ["draft", "received", "refunded", "cancelled"] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

/** Goods coming back. Restocking posts a return_in movement; refunds are money. */
export const stockReturn = pgTable(
  "stock_return",
  {
    ...createOrgScopedColumns(),
    reference: text("reference").notNull(),
    orderId: uuid("order_id").references(() => order.id, { onDelete: "set null" }),
    contactId: uuid("contact_id").references(() => contact.id, { onDelete: "set null" }),
    status: text("status").$type<ReturnStatus>().notNull().default("draft"),
    /** When false the goods are not put back into sellable stock. */
    restock: boolean("restock").notNull().default(true),
    reason: text("reason"),
    notes: text("notes"),
    ...createMoneyTotalColumns(),
    receivedAt: timestamp("received_at"),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("stock_return_organization_id_idx").on(t.organizationId),
    index("stock_return_organization_id_status_idx").on(t.organizationId, t.status),
    uniqueIndex("stock_return_organization_id_reference_uidx").on(t.organizationId, t.reference),
  ],
);

export const stockReturnItem = pgTable(
  "stock_return_item",
  {
    ...createOrgScopedColumns(),
    returnId: uuid("return_id")
      .notNull()
      .references(() => stockReturn.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariant.id, { onDelete: "cascade" }),
    quantity: numeric("quantity", { precision: 15, scale: 3, mode: "number" }).notNull(),
    unitPriceMinor: integer("unit_price_minor").notNull().default(0),
    totalMinor: integer("total_minor").notNull().default(0),
  },
  (t) => [
    index("stock_return_item_return_id_idx").on(t.returnId),
    index("stock_return_item_product_id_idx").on(t.productId),
  ],
);
