import { index, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createActiveTimestampColumns } from "../active-timestamp-columns";
import { createOrgScopedColumns } from "../org-scoped-columns";

export const productCategory = pgTable(
  "product_category",
  {
    ...createOrgScopedColumns(),
    name: text("name").notNull(),
    // Terminals and storefronts both need a stable, immutable handle for a
    // category (deep links, a saved filter). `slug` already covers that, so no
    // second identifier is introduced here.
    /** URL-safe handle, unique per organization. */
    slug: text("slug").notNull(),
    description: text("description"),
    /** Self-reference so a seller can nest Drinks > Juices. Null at the root. */
    parentCategoryId: uuid("parent_category_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...createActiveTimestampColumns(),
  },
  (t) => [
    index("product_category_organization_id_idx").on(t.organizationId),
    uniqueIndex("product_category_organization_id_slug_uidx").on(t.organizationId, t.slug),
    index("product_category_parent_id_idx").on(t.parentCategoryId),
  ],
);
