import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { contact } from "../contacts/contact";
import { order } from "../orders/order";
import { user } from "../auth/user";

export const payment = pgTable(
  "payment",
  {
    ...createOrgScopedColumns(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contact.id, { onDelete: "set null" }),
    amountKobo: integer("amount_kobo").notNull(),
    currency: text("currency").notNull().default("NGN"),
    method: text("method").notNull().default("cash"),
    reference: text("reference"),
    notes: text("notes"),
    paidAt: timestamp("paid_at").notNull().defaultNow(),
    createdByUserId: uuid("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("payment_organization_id_idx").on(t.organizationId),
    index("payment_organization_id_order_id_idx").on(t.organizationId, t.orderId),
    index("payment_organization_id_contact_id_idx").on(t.organizationId, t.contactId),
    index("payment_created_by_user_id_idx").on(t.createdByUserId),
  ],
);
