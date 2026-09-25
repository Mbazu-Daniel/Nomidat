import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { user } from "../auth/user";
export const phoneInvitation = pgTable(
  "phone_invitation",
  {
    ...createOrgScopedColumns(),
    phoneNumber: text("phone_number").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("phone_invitation_org_idx").on(t.organizationId),
    index("phone_invitation_phone_idx").on(t.phoneNumber),
  ],
);
