import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { contact } from "../contacts/contact";
import { order } from "../orders/order";

export const paymentLink = pgTable(
  "payment_link",
  {
    ...createOrgScopedColumns(),
    provider: text("provider").notNull().default("paystack"),
    orderId: uuid("order_id").references(() => order.id, { onDelete: "set null" }),
    contactId: uuid("contact_id").references(() => contact.id, { onDelete: "set null" }),
    amountKobo: integer("amount_kobo").notNull(),
    currency: text("currency").notNull().default("NGN"),
    reference: text("reference").notNull().unique(),
    providerUrl: text("provider_url"),
    status: text("status").notNull().default("pending"),
    paidAt: timestamp("paid_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("payment_link_organization_id_idx").on(t.organizationId),
    index("payment_link_order_id_idx").on(t.orderId),
    index("payment_link_contact_id_idx").on(t.contactId),
  ],
);
