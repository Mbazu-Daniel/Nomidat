import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { generateId } from "../id";
import { organization } from "./organization";
import { user } from "./user";

export const member = pgTable(
  "member",
  {
    id: uuid("id")
      .$defaultFn(() => generateId())
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("member_organization_id_idx").on(t.organizationId),
    index("member_user_id_idx").on(t.userId),
  ],
);
