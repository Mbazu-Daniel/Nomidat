import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { user } from "../auth/user";

export const channelLinkCode = pgTable(
  "channel_link_code",
  {
    ...createOrgScopedColumns(),
    code: text("code").notNull().unique(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("channel_link_code_organization_id_idx").on(t.organizationId),
    index("channel_link_code_code_idx").on(t.code),
  ],
);
