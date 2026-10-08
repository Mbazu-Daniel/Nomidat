import { boolean, index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { createActiveTimestampColumns } from "../active-timestamp-columns";
import { createOrgScopedColumns } from "../org-scoped-columns";

export const warehouse = pgTable(
  "warehouse",
  {
    ...createOrgScopedColumns(),
    name: text("name").notNull(),
    // Short code the seller types to pick a site quickly, e.g. MAIN.
    code: text("code").notNull(),
    kind: text("kind").notNull().default("store"),
    address: text("address"),
    phone: text("phone"),
    isDefault: boolean("is_default").notNull().default(false),
    ...createActiveTimestampColumns(),
  },
  (t) => [
    index("warehouse_organization_id_idx").on(t.organizationId),
    uniqueIndex("warehouse_organization_id_code_uidx").on(t.organizationId, t.code),
    // The pair a tenant-scoped foreign key references, so a purchase order can
    // only name a warehouse belonging to its own organization. Postgres requires
    // a unique target for a composite key; `id` alone is already unique, so this
    // constrains nothing new, it just makes the pair referenceable.
    uniqueIndex("warehouse_id_organization_id_uidx").on(t.id, t.organizationId),
  ],
);
