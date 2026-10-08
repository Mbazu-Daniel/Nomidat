import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { createMoneyTotalColumns } from "../money-total-columns";
import { contact } from "../contacts/contact";

// "orders" (plural): "order" is reserved in Postgres.
export const order = pgTable(
  "orders",
  {
    ...createOrgScopedColumns(),
    orderNumber: text("order_number"),
    contactId: uuid("contact_id").references(() => contact.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending"),
    source: text("source").notNull().default("manual"),
    ...createMoneyTotalColumns(),
    paidAt: timestamp("paid_at"),
    paymentReference: text("payment_reference"),
    paymentProvider: text("payment_provider"),
    /**
     * How the money arrived, recorded on the sale itself and not only on the
     * Payment row.
     *
     * The Payment row cannot answer this alone: a sale taken on credit writes no
     * payment at creation, so the method the customer will eventually use is
     * unrecorded, and a sale partly paid later has no single method to read. A
     * till that reports "how do people pay" would otherwise see cash only — every
     * other method having been dropped on the floor.
     *
     * Not foreign-keyed to `payment.method`: it is an attribute of the sale, and
     * the two can legitimately differ (transfer paid partly in cash).
     */
    paymentMethod: text("payment_method"),
    // Terminal-generated idempotency key so replaying an offline sale cannot double-charge.
    clientReference: text("client_reference"),
    completedAt: timestamp("completed_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("orders_organization_id_idx").on(t.organizationId),
    index("orders_organization_id_contact_id_idx").on(t.organizationId, t.contactId),
    index("orders_organization_id_status_idx").on(t.organizationId, t.status),
    index("orders_organization_id_created_at_idx").on(t.organizationId, t.createdAt),
    index("orders_organization_id_source_idx").on(t.organizationId, t.source),
    // Postgres treats NULLs as distinct, so unpaid rows keep a free client_reference slot.
    uniqueIndex("orders_organization_id_order_number_uidx").on(t.organizationId, t.orderNumber),
    uniqueIndex("orders_organization_id_client_reference_uidx").on(
      t.organizationId,
      t.clientReference,
    ),
  ],
);
