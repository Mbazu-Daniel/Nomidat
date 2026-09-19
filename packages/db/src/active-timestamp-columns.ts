import { boolean, timestamp } from "drizzle-orm/pg-core";

export function createActiveTimestampColumns() {
  return {
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  };
}
