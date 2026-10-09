import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { generateId } from "../id";

export const organization = pgTable("organization", {
  id: uuid("id")
    .$defaultFn(() => generateId())
    .primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  /**
   * Legacy inline logo: a base64 data URL.
   *
   * Superseded by `logoKey`, which points at the object in R2. Kept because
   * `logo` is Better Auth's own column and is what the organization editor has
   * always written, so existing rows carry their logo here and switching reads
   * over would blank every one of them. New writes go to `logoKey`.
   *
   * An inline image is also why this needed replacing rather than extending: a
   * data URL is bounded by the 65,000-byte guard the invoice renderer applies,
   * past which the logo silently disappears from the PDF and is replaced by the
   * vector mark. Nothing failed — the invoice just quietly lost the logo.
   */
  logo: text("logo"),
  /**
   * Key of the organization's logo in the R2 bucket, e.g.
   * `{organizationId}/business-logos/a3f9c2e1b0d4-logo.png`.
   *
   * The key rather than the URL, so the public hostname stays a deployment
   * setting. This is the organization's logo: the same one the storefront shows,
   * which is also what the invoice prints. See `ARCHITECTURE.md`.
   */
  logoKey: text("logo_key"),
  /**
   * ISO 4217 code for this business's money. Everything is stored in the minor
   * unit of this currency, so switching it later is not a data migration.
   */
  currency: text("currency").notNull().default("NGN"),
  /** Sales tax in basis points, e.g. 750 for 7.5%. Zero means no tax is charged. */
  taxRateBps: integer("tax_rate_bps").notNull().default(0),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
