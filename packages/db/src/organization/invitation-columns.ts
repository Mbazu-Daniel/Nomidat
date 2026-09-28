import { text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "../auth/user";

export function createInvitationColumns() {
  return {
    role: text("role").notNull(),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  };
}
