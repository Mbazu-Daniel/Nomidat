import { index, numeric, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { product } from "../products/product";
import { productVariant } from "./product-variant";
import { warehouse } from "./warehouse";

/** Quantities are decimal: a shop sells 1.5 kg, not 1 or 2. */
export type Quantity = number;

/**
 * The source of truth for how much stock exists. One row per product at one warehouse.
 * Only a recorded Stock Movement may change these numbers (see ADR-0001).
 */
export const stock = pgTable(
  "stock",
  {
    ...createOrgScopedColumns(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    /** Null when the product has no variants; stock is then held for the product itself. */
    variantId: uuid("variant_id").references(() => productVariant.id, {
      onDelete: "cascade",
    }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouse.id, { onDelete: "cascade" }),
    onHand: numeric("on_hand", { precision: 15, scale: 3, mode: "number" }).notNull().default(0),
    reserved: numeric("reserved", { precision: 15, scale: 3, mode: "number" }).notNull().default(0),
    inTransit: numeric("in_transit", { precision: 15, scale: 3, mode: "number" })
      .notNull()
      .default(0),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("stock_organization_id_idx").on(t.organizationId),
    index("stock_organization_id_product_id_idx").on(t.organizationId, t.productId),
    index("stock_organization_id_warehouse_id_idx").on(t.organizationId, t.warehouseId),
    // Postgres treats NULLs as distinct, so one index cannot cover both cases:
    // a single unique index on (org, product, variant, warehouse) would happily
    // accept unlimited duplicate rows for variant-less products. Two partial
    // indexes give a real guarantee in each case.
    uniqueIndex("stock_org_product_wh_uidx")
      .on(t.organizationId, t.productId, t.warehouseId)
      .where(sql`${t.variantId} is null`),
    uniqueIndex("stock_org_product_variant_wh_uidx")
      .on(t.organizationId, t.productId, t.variantId, t.warehouseId)
      .where(sql`${t.variantId} is not null`),
  ],
);
