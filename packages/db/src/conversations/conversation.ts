import { index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { user } from "../auth/user";
import { channelIdentity } from "../channel/channel-identity";
import { contact } from "../contacts/contact";

export const conversation = pgTable(
  "conversation",
  {
    ...createOrgScopedColumns(),
    channelIdentityId: uuid("channel_identity_id").references(() => channelIdentity.id, {
      onDelete: "cascade",
    }),
    contactId: uuid("contact_id").references(() => contact.id, { onDelete: "set null" }),
    createdByUserId: uuid("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    lastMessageAt: timestamp("last_message_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("conversation_organization_id_idx").on(t.organizationId),
    index("conversation_channel_identity_id_idx").on(t.channelIdentityId),
    index("conversation_contact_id_idx").on(t.contactId),
    index("conversation_created_by_user_id_idx").on(t.createdByUserId),
  ],
);
