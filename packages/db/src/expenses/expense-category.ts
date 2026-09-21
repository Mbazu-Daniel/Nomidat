import { boolean, index, pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { generateId } from "../id";
import { organization } from "../organization/organization";

export const expenseCategory = pgTable("expense_category", {
  id: uuid("id")
    .$defaultFn(() => generateId())
    .primaryKey(),
  organizationId: uuid("organization_id").references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("expense_category_organization_id_idx").on(t.organizationId),
  uniqueIndex("expense_category_organization_id_name_uidx").on(t.organizationId, t.name),
]);
