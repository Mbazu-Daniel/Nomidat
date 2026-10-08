import { boolean, index, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createActiveTimestampColumns } from "../active-timestamp-columns";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { product } from "../products/product";

/**
 * A specific sellable option of a product — a size, flavour or pack count.
 * A product with no variants is still sellable on its own, so stock rows may
 * carry a null variant.
 */
export const productVariant = pgTable(
  "product_variant",
  {
    ...createOrgScopedColumns(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sku: text("sku"),
    barcode: text("barcode"),
    priceMinor: integer("price_minor").notNull().default(0),
    costMinor: integer("cost_minor").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    ...createActiveTimestampColumns(),
  },
  (t) => [
    index("product_variant_organization_id_idx").on(t.organizationId),
    index("product_variant_product_id_idx").on(t.productId),
    uniqueIndex("product_variant_organization_id_sku_uidx").on(t.organizationId, t.sku),
  ],
);
