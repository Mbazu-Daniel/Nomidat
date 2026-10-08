import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { invoice } from "./invoice";

/**
 * A customer's proposed price for an invoice, submitted through a share link.
 *
 * This is a separate record rather than a column on `invoice` on purpose: a
 * proposal never touches the invoice's own totals. The amount only changes when
 * the seller explicitly accepts, so a stranger holding a link can propose
 * anything, but cannot move a balance.
 */
export const invoiceNegotiation = pgTable(
  "invoice_negotiation",
  {
    ...createOrgScopedColumns(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoice.id, { onDelete: "cascade" }),
    /** Always strictly less than the invoice total; enforced again on write. */
    proposedTotalMinor: integer("proposed_total_minor").notNull(),
    message: text("message"),
    status: text("status").notNull().default("pending"),
    decidedAt: timestamp("decided_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("invoice_negotiation_organization_id_idx").on(t.organizationId),
    index("invoice_negotiation_invoice_id_idx").on(t.invoiceId),
    // One live proposal per invoice. A link holder cannot flood the seller's
    // inbox with competing offers; they must wait for a decision first.
    uniqueIndex("invoice_negotiation_one_pending_per_invoice_uidx")
      .on(t.invoiceId)
      .where(sql`${t.status} = 'pending'`),
  ],
);
