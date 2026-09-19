import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { user } from "../auth/user";
import { expenseCategory } from "./expense-category";

export const expense = pgTable(
  "expense",
  {
    ...createOrgScopedColumns(),
    categoryId: uuid("category_id").references(() => expenseCategory.id, {
      onDelete: "set null",
    }),
    amountKobo: integer("amount_kobo").notNull(),
    description: text("description"),
    spentAt: timestamp("spent_at").notNull().defaultNow(),
    paymentMethod: text("payment_method").notNull().default("cash"),
    receiptUrl: text("receipt_url"),
    createdByUserId: uuid("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("expense_organization_id_idx").on(t.organizationId),
    index("expense_organization_id_spent_at_idx").on(t.organizationId, t.spentAt),
    index("expense_organization_id_category_id_idx").on(t.organizationId, t.categoryId),
    index("expense_created_by_user_id_idx").on(t.createdByUserId),
  ],
);
