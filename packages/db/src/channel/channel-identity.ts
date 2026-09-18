import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { generateId } from "../id";
import { organization } from "../auth/organization";

export const channelIdentity = pgTable(
  "channel_identity",
  {
    id: uuid("id")
      .$defaultFn(() => generateId())
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    displayName: text("display_name"),
    lastInboundAt: timestamp("last_inbound_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("channel_identity_provider_external_id_uidx").on(t.provider, t.externalId),
    index("channel_identity_organization_id_idx").on(t.organizationId),
  ],
);
