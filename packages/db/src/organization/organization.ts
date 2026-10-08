import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { generateId } from "../id";

export const organization = pgTable("organization", {
  id: uuid("id")
    .$defaultFn(() => generateId())
    .primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  /**
   * ISO 4217 code for this business's money. Everything is stored in the minor
   * unit of this currency, so switching it later is not a data migration.
   */
  currency: text("currency").notNull().default("NGN"),
  /** Sales tax in basis points, e.g. 750 for 7.5%. Zero means no tax is charged. */
  taxRateBps: integer("tax_rate_bps").notNull().default(0),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
