import { boolean, index, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { createActiveTimestampColumns } from "../active-timestamp-columns";
import { createOrgScopedColumns } from "../org-scoped-columns";

export const STOREFRONT_TEMPLATES = ["minimal", "catalog", "boutique"] as const;
export type StorefrontTemplate = (typeof STOREFRONT_TEMPLATES)[number];

/** One storefront per organization. Holds theme, SEO, checkout config and pages. */
export const storefrontSettings = pgTable(
  "storefront_settings",
  {
    ...createOrgScopedColumns(),
    template: text("template").$type<StorefrontTemplate>().notNull().default("minimal"),
    /** Only a published storefront is reachable from the public API. */
    published: boolean("published").notNull().default(false),
    theme: jsonb("theme").$type<Record<string, unknown>>().notNull().default({}),
    seo: jsonb("seo").$type<Record<string, unknown>>().notNull().default({}),
    checkout: jsonb("checkout").$type<Record<string, unknown>>().notNull().default({}),
    pages: jsonb("pages").$type<Record<string, unknown>>().notNull().default({}),
    /**
     * Seller-authored CSS. Stored as text but always sanitised before it is
     * served, because it is injected into a public page.
     */
    customCss: text("custom_css"),
    ...createActiveTimestampColumns(),
  },
  (t) => [
    uniqueIndex("storefront_settings_organization_id_uidx").on(t.organizationId),
    index("storefront_settings_published_idx").on(t.published),
  ],
);
