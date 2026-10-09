import { index, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createActiveTimestampColumns } from "../active-timestamp-columns";
import { unitOfMeasure } from "../inventory/unit-of-measure";
import { createOrgScopedColumns } from "../org-scoped-columns";

export const product = pgTable(
  "product",
  {
    ...createOrgScopedColumns(),
    name: text("name").notNull(),
    sku: text("sku"),
    barcode: text("barcode"),
    description: text("description"),
    priceMinor: integer("price_minor").notNull().default(0),
    costMinor: integer("cost_minor").notNull().default(0),
    // Stock quantity lives in `stock`, one row per product per warehouse (ADR-0001).
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    unit: text("unit").notNull().default("pcs"),
    /** The unit this product is counted in. Stock is held in base units of it. */
    baseUnitOfMeasureId: uuid("base_unit_of_measure_id").references(() => unitOfMeasure.id, {
      onDelete: "set null",
    }),
    /**
     * Key of the product's picture in the R2 bucket, e.g.
     * `{organizationId}/product-images/a3f9c2e1b0d4-jollof.jpg`.
     *
     * The key rather than the full URL is what is stored: the public hostname is
     * a deployment setting (a custom domain, or the `r2.dev` fallback) and can
     * change without a migration, whereas rewriting every row to follow it would
     * mean touching every product in every organization. Readers join the
     * hostname back on at render time.
     *
     * Nullable because a product with no photo is ordinary — nothing in the
     * system requires one, and the till renders a placeholder rather than
     * refusing to list it.
     */
    imageKey: text("image_key"),
    ...createActiveTimestampColumns(),
  },
  (t) => [
    index("product_organization_id_idx").on(t.organizationId),
    index("product_organization_id_name_idx").on(t.organizationId, t.name),
    uniqueIndex("product_organization_id_sku_uidx").on(t.organizationId, t.sku),
    index("product_organization_id_barcode_idx").on(t.organizationId, t.barcode),
  ],
);
