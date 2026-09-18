import { uuid } from "drizzle-orm/pg-core";
import { generateId } from "./id";
import { organization } from "./organization/organization";

/** Shared `id` + `organizationId` preamble for organization-scoped tables. */
export function createOrgScopedColumns() {
  return {
    id: uuid("id")
      .$defaultFn(() => generateId())
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
  };
}
