import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";

/**
 * Where a tenant's money is sent.
 *
 * The name is stored because Paystack does not reverse a payout made to the wrong
 * account, so the destination is resolved with the bank before it is saved.
 */
export const payoutAccount = pgTable(
  "payout_account",
  {
    ...createOrgScopedColumns(),
    businessName: text("business_name").notNull(),
    bankCode: text("bank_code").notNull(),
    bankName: text("bank_name").notNull(),
    accountNumber: text("account_number").notNull(),
    /** Supplied by the bank, never by the tenant. */
    accountName: text("account_name").notNull(),
    subaccountCode: text("subaccount_code"),
    platformFeeBps: integer("platform_fee_bps").notNull().default(0),
    activatedAt: timestamp("activated_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("payout_account_organization_id_uidx").on(t.organizationId),
    index("payout_account_subaccount_code_idx").on(t.subaccountCode),
  ],
);

/**
 * An account a customer transfers into instead of redirecting to checkout.
 *
 * `splitCode` is what makes it a routed payment: without it the transfer
 * collects into the platform's own balance.
 */
export const virtualAccount = pgTable(
  "virtual_account",
  {
    ...createOrgScopedColumns(),
    accountNumber: text("account_number").notNull(),
    accountName: text("account_name").notNull(),
    bankName: text("bank_name").notNull(),
    customerCode: text("customer_code"),
    splitCode: text("split_code"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("virtual_account_organization_id_idx").on(t.organizationId),
    // An account number belongs to exactly one tenant, so an inbound transfer can
    // be attributed by the number alone.
    uniqueIndex("virtual_account_account_number_uidx").on(t.accountNumber),
  ],
);
