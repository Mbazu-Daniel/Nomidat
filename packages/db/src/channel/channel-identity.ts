import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";

export const channelIdentity = pgTable(
  "channel_identity",
  {
    ...createOrgScopedColumns(),
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
