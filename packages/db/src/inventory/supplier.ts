import { index, pgTable, text } from "drizzle-orm/pg-core";
import { createActiveTimestampColumns } from "../active-timestamp-columns";
import { createOrgScopedColumns } from "../org-scoped-columns";

export const supplier = pgTable(
  "supplier",
  {
    ...createOrgScopedColumns(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    notes: text("notes"),
    ...createActiveTimestampColumns(),
  },
  (t) => [index("supplier_organization_id_idx").on(t.organizationId)],
);
