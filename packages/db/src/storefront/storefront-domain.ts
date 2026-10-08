import { boolean, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createActiveTimestampColumns } from "../active-timestamp-columns";
import { createOrgScopedColumns } from "../org-scoped-columns";

/**
 * A hostname that points at one organization's storefront. This is what makes
 * `shop.example.com` and `my-brand.ng` both work: the same lookup serves a
 * subdomain and a custom domain, so neither needs special-casing elsewhere.
 */
export const storefrontDomain = pgTable(
  "storefront_domain",
  {
    ...createOrgScopedColumns(),
    /** Stored lowercase and without a port. */
    hostname: text("hostname").notNull(),
    kind: text("kind").notNull().default("custom"),
    isPrimary: boolean("is_primary").notNull().default(false),
    verifiedAt: timestamp("verified_at"),
    ...createActiveTimestampColumns(),
  },
  (t) => [
    // A hostname can only ever belong to one organization.
    uniqueIndex("storefront_domain_hostname_uidx").on(t.hostname),
    index("storefront_domain_organization_id_idx").on(t.organizationId),
  ],
);
