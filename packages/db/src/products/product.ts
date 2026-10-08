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
    ...createActiveTimestampColumns(),
  },
  (t) => [
    index("product_organization_id_idx").on(t.organizationId),
    index("product_organization_id_name_idx").on(t.organizationId, t.name),
    uniqueIndex("product_organization_id_sku_uidx").on(t.organizationId, t.sku),
    index("product_organization_id_barcode_idx").on(t.organizationId, t.barcode),
  ],
);
