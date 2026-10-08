import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createMoneyTotalColumns } from "../money-total-columns";
import { createOrgScopedColumns } from "../org-scoped-columns";

/**
 * A basket held against an anonymous session token. The token is the only
 * credential a shopper has, so it is a high-entropy value and the cart is
 * always scoped to one organization.
 */
export const cart = pgTable(
  "cart",
  {
    ...createOrgScopedColumns(),
    token: text("token").notNull(),
    status: text("status").notNull().default("open"),
    contactId: uuid("contact_id"),
    ...createMoneyTotalColumns(),
    /** Set once the cart becomes an order, so a shopper can track it. */
    convertedOrderId: uuid("converted_order_id"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // The token is the shopper's only credential, so it must be globally unique.
    uniqueIndex("cart_token_uidx").on(t.token),
    index("cart_organization_id_status_idx").on(t.organizationId, t.status),
  ],
);

export const cartItem = pgTable(
  "cart_item",
  {
    ...createOrgScopedColumns(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => cart.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull(),
    variantId: uuid("variant_id"),
    productName: text("product_name").notNull(),
    /** Name and price are snapshotted so the basket still renders if the product changes. */
    unitPriceMinor: integer("unit_price_minor").notNull(),
    quantity: integer("quantity").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("cart_item_cart_id_idx").on(t.cartId),
    index("cart_item_product_id_idx").on(t.productId),
  ],
);
