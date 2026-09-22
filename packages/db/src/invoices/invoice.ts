import { index, pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { createMoneyTotalColumns } from "../money-total-columns";
import { contact } from "../contacts/contact";

export const invoice = pgTable(
  "invoice",
  {
    ...createOrgScopedColumns(),
    contactId: uuid("contact_id").references(() => contact.id, { onDelete: "set null" }),
    invoiceNumber: text("invoice_number").notNull(),
    status: text("status").notNull().default("draft"),
    ...createMoneyTotalColumns(),
    dueDate: timestamp("due_date"),
    paidAt: timestamp("paid_at"),
    pdfUrl: text("pdf_url"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("invoice_organization_id_idx").on(t.organizationId),
    uniqueIndex("invoice_organization_id_number_uidx").on(t.organizationId, t.invoiceNumber),
    index("invoice_organization_id_contact_id_idx").on(t.organizationId, t.contactId),
    index("invoice_organization_id_status_idx").on(t.organizationId, t.status),
  ],
);
