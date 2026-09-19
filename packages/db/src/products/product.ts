import { index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { createActiveTimestampColumns } from "../active-timestamp-columns";
import { createOrgScopedColumns } from "../org-scoped-columns";

export const product = pgTable(
  "product",
  {
    ...createOrgScopedColumns(),
    name: text("name").notNull(),
    sku: text("sku"),
    description: text("description"),
    priceKobo: integer("price_kobo").notNull().default(0),
    costKobo: integer("cost_kobo").notNull().default(0),
    stockQuantity: integer("stock_quantity").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    unit: text("unit").notNull().default("pcs"),
    ...createActiveTimestampColumns(),
  },
  (t) => [
    index("product_organization_id_idx").on(t.organizationId),
    index("product_organization_id_name_idx").on(t.organizationId, t.name),
    uniqueIndex("product_organization_id_sku_uidx").on(t.organizationId, t.sku),
  ],
);
