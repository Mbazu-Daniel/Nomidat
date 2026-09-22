import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { generateId } from "../id";
import { organization } from "../organization/organization";

export const inboundUpdate = pgTable(
  "inbound_update",
  {
    id: uuid("id").$defaultFn(() => generateId()).primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    rawUpdateId: text("raw_update_id").notNull(),
    response: text("response"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (t) => [
    uniqueIndex("inbound_update_provider_update_unique").on(
      t.organizationId,
      t.provider,
      t.rawUpdateId,
    ),
    index("inbound_update_organization_id_idx").on(t.organizationId),
  ],
);
