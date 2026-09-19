import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { generateId } from "../id";

export const verification = pgTable("verification", {
  id: uuid("id")
    .$defaultFn(() => generateId())
    .primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
