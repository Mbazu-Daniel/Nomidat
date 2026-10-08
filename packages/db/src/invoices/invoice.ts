import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { createMoneyTotalColumns } from "../money-total-columns";
import { contact } from "../contacts/contact";

export const invoice = pgTable(
  "invoice",
  {
    ...createOrgScopedColumns(),
    contactId: uuid("contact_id").references(() => contact.id, { onDelete: "set null" }),
    sourceSaleId: uuid("source_sale_id"),
    invoiceNumber: text("invoice_number").notNull(),
    status: text("status").notNull().default("draft"),
    ...createMoneyTotalColumns(),
    dueDate: timestamp("due_date"),
    paidAt: timestamp("paid_at"),
    pdfUrl: text("pdf_url"),
    /**
     * Unguessable token that makes an invoice readable without an account. It is
     * globally unique so a share link can be resolved without knowing which
     * organization it belongs to.
     */
    shareCode: text("share_code"),
    shareEnabled: boolean("share_enabled").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("invoice_organization_id_idx").on(t.organizationId),
    uniqueIndex("invoice_organization_id_number_uidx").on(t.organizationId, t.invoiceNumber),
    index("invoice_organization_id_contact_id_idx").on(t.organizationId, t.contactId),
    uniqueIndex("invoice_organization_id_source_sale_uidx").on(t.organizationId, t.sourceSaleId),
    index("invoice_organization_id_status_idx").on(t.organizationId, t.status),
    uniqueIndex("invoice_share_code_uidx").on(t.shareCode),
  ],
);
