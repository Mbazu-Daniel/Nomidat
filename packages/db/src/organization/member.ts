import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { user } from "../auth/user";

export const member = pgTable(
  "member",
  {
    ...createOrgScopedColumns(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    /**
     * The person's name and face inside this business, not on their login. One
     * user can be "Ada" the owner at one shop and just "A. Bello" at another, so
     * a staff profile cannot hang off the user row.
     */
    firstName: text("first_name"),
    lastName: text("last_name"),
    /** Data URL. Optional, and validated on read rather than trusted raw. */
    avatar: text("avatar"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("member_organization_id_idx").on(t.organizationId),
    index("member_user_id_idx").on(t.userId),
  ],
);
