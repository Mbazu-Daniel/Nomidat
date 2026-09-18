import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { generateId } from "../id";

export const organization = pgTable("organization", {
  id: uuid("id")
    .$defaultFn(() => generateId())
    .primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
