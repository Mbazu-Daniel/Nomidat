import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { generateId } from "../id";

export const expenseCategory = pgTable("expense_category", {
  id: uuid("id")
    .$defaultFn(() => generateId())
    .primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  isDefault: boolean("is_default").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
