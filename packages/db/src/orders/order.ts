import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { createMoneyTotalColumns } from "../money-total-columns";
import { contact } from "../contacts/contact";

// "orders" (plural): "order" is reserved in Postgres.
export const order = pgTable(
  "orders",
  {
    ...createOrgScopedColumns(),
    contactId: uuid("contact_id").references(() => contact.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending"),
    ...createMoneyTotalColumns(),
    paidAt: timestamp("paid_at"),
    paymentReference: text("payment_reference"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("orders_organization_id_idx").on(t.organizationId),
    index("orders_organization_id_contact_id_idx").on(t.organizationId, t.contactId),
    index("orders_organization_id_status_idx").on(t.organizationId, t.status),
    index("orders_organization_id_created_at_idx").on(t.organizationId, t.createdAt),
  ],
);
