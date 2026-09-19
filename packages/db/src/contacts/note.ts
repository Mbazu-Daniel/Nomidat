import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { user } from "../auth/user";
import { contact } from "./contact";

export const note = pgTable(
  "note",
  {
    ...createOrgScopedColumns(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contact.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("note_organization_id_idx").on(t.organizationId),
    index("note_contact_id_idx").on(t.contactId),
    index("note_created_by_user_id_idx").on(t.createdByUserId),
  ],
);
