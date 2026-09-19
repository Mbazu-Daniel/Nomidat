import { index, pgTable, text } from "drizzle-orm/pg-core";
import { createActiveTimestampColumns } from "../active-timestamp-columns";
import { createOrgScopedColumns } from "../org-scoped-columns";

export const contact = pgTable(
  "contact",
  {
    ...createOrgScopedColumns(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    kind: text("kind").notNull().default("lead"),
    source: text("source"),
    ...createActiveTimestampColumns(),
  },
  (t) => [
    index("contact_organization_id_idx").on(t.organizationId),
    index("contact_organization_id_name_idx").on(t.organizationId, t.name),
    index("contact_organization_id_phone_idx").on(t.organizationId, t.phone),
  ],
);
