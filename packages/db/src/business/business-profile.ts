import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";

export const businessProfile = pgTable(
  "business_profile",
  {
    ...createOrgScopedColumns(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    currency: text("currency").notNull().default("NGN"),
    paymentProvider: text("payment_provider").notNull().default("paystack"),
    providerSecretKeyEncrypted: text("provider_secret_key_encrypted"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("business_profile_organization_id_uidx").on(t.organizationId)],
);
