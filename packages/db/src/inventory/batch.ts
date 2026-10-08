import { sql } from "drizzle-orm";
import {
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createActiveTimestampColumns } from "../active-timestamp-columns";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { product } from "../products/product";
import { productVariant } from "./product-variant";

/** A lot of a product made at one time, tracked for expiry. */
export const batch = pgTable(
  "batch",
  {
    ...createOrgScopedColumns(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariant.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    expiresAt: timestamp("expires_at"),
    quantityReceived: numeric("quantity_received", {
      precision: 15,
      scale: 3,
      mode: "number",
    })
      .notNull()
      .default(0),
    /**
     * Batch quantity is held here rather than on `stock`, because a Stock Level is
     * unique per product/variant/warehouse and cannot hold one row per batch.
     * Remaining = received - consumed.
     */
    quantityConsumed: numeric("quantity_consumed", {
      precision: 15,
      scale: 3,
      mode: "number",
    })
      .notNull()
      .default(0),
    ...createActiveTimestampColumns(),
  },
  (t) => [
    index("batch_organization_id_idx").on(t.organizationId),
    index("batch_organization_id_product_id_idx").on(t.organizationId, t.productId),
    index("batch_expires_at_idx").on(t.expiresAt),
    uniqueIndex("batch_organization_id_code_uidx").on(t.organizationId, t.code),
    // Consumption can never exceed what was received.
    check(
      "batch_consumed_within_received_chk",
      sql`${t.quantityConsumed} >= 0 and ${t.quantityConsumed} <= ${t.quantityReceived}`,
    ),
  ],
);
