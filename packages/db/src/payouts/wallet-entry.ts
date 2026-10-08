import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { user } from "../auth/user";

/**
 * Append-only money movements per tenant.
 *
 * `balanceAfterMinor` is stored on every row rather than derived by summing the
 * ledger at read time. That makes a tenant's balance a single lookup, and — more
 * importantly — makes any historical balance reconstructible and auditable
 * without replaying the whole table.
 *
 * Amounts are always positive; `kind` carries the direction. Storing signed
 * amounts invites a sign error that silently credits a withdrawal.
 */
export const walletEntry = pgTable(
  "wallet_entry",
  {
    ...createOrgScopedColumns(),
    kind: text("kind").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("NGN"),
    balanceAfterMinor: integer("balance_after_minor").notNull(),
    /** The payment, invoice or payout this movement arose from. */
    reference: text("reference"),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("wallet_entry_organization_id_created_at_idx").on(t.organizationId, t.createdAt),
    index("wallet_entry_organization_id_reference_idx").on(t.organizationId, t.reference),
    // Webhooks are redelivered. One payment reference may only ever produce one
    // credit, so a replay cannot pay a tenant twice. Entries without a reference
    // (manual adjustments) are exempt, since NULLs are distinct anyway.
    uniqueIndex("wallet_entry_organization_id_reference_uidx")
      .on(t.organizationId, t.reference)
      .where(sql`${t.reference} is not null`),
  ],
);

/**
 * A tenant asking for money out. Kept as a request rather than an immediate
 * transfer so a human can review it, and so the destination bank details are
 * snapshotted at request time — the tenant may change their bank before it is
 * paid, and we must pay where they asked.
 */
export const payoutRequest = pgTable(
  "payout_request",
  {
    ...createOrgScopedColumns(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("NGN"),
    status: text("status").notNull().default("requested"),
    bankCode: text("bank_code").notNull(),
    bankName: text("bank_name").notNull(),
    accountNumber: text("account_number").notNull(),
    accountName: text("account_name").notNull(),
    requestedByUserId: uuid("requested_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** Why a request was refused, shown to the tenant rather than silently dropped. */
    reason: text("reason"),
    decidedAt: timestamp("decided_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("payout_request_organization_id_created_at_idx").on(t.organizationId, t.createdAt),
    index("payout_request_organization_id_status_idx").on(t.organizationId, t.status),
    index("payout_request_requested_by_user_id_idx").on(t.requestedByUserId),
  ],
);
