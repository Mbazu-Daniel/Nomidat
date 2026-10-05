import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "@nomidat/db";
import { organization, storefrontDomain, storefrontSettings } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { DomainVerificationService } from "./domain-verification.service";
import { normalizeHostname } from "./hostname";
import { sanitizeStorefrontCss } from "./sanitize-css";
import { sanitizeStorefrontTheme } from "./types/storefront.type";
import type { ResolvedStore } from "./types/storefront.type";

@Injectable()
export class StorefrontResolver {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly domains: DomainVerificationService,
  ) {}

  /**
   * Turns a hostname into the shop it belongs to. One lookup covers both
   * `shop.example.com` and a custom `my-brand.ng`, so callers never have to
   * know which kind of address the shopper typed.
   */
  async resolveHost(rawHost: string): Promise<ResolvedStore | null> {
    const hostname = normalizeHostname(rawHost);
    if (!hostname) return null;

    const [linked] = await this.db
      .select({
        organizationId: storefrontDomain.organizationId,
        hostname: storefrontDomain.hostname,
        slug: organization.slug,
        template: storefrontSettings.template,
        published: storefrontSettings.published,
      })
      .from(storefrontDomain)
      .innerJoin(
        organization,
        eq(organization.id, storefrontDomain.organizationId),
      )
      .leftJoin(
        storefrontSettings,
        eq(storefrontSettings.organizationId, storefrontDomain.organizationId),
      )
      .where(eq(storefrontDomain.hostname, hostname))
      .limit(1);

    if (!linked) return null;

    // An unverified hostname is never served, so a seller cannot point a domain
    // they do not control at their own shop.
    if (!(await this.domains.isVerified(linked.organizationId, linked.hostname))) {
      return null;
    }

    return {
      organizationId: linked.organizationId,
      slug: linked.slug,
      hostname: linked.hostname,
      template: linked.template ?? "minimal",
      published: linked.published ?? false,
    };
  }

  /**
   * The one seam that turns a slug into a shop a shopper may see.
   *
   * Both the catalog and the config go through here, so an unpublished storefront
   * cannot be read through one path and not the other. Publication is the
   * seller's decision, so an unpublished shop must be indistinguishable from one
   * that does not exist.
   */
  async resolvePublishedShop(slug: string): Promise<{ organizationId: string }> {
    const [row] = await this.db
      .select({
        organizationId: organization.id,
        published: storefrontSettings.published,
      })
      .from(organization)
      // An inner join is deliberate: a shop with no settings row is not public.
      .innerJoin(storefrontSettings, eq(storefrontSettings.organizationId, organization.id))
      .where(eq(organization.slug, slug))
      .limit(1);

    if (!row?.published) throw new NotFoundException("Storefront not found.");
    return { organizationId: row.organizationId };
  }

  async getPublicConfig(slug: string) {
    // The seam decides what is public; this method only widens the row.
    const { organizationId } = await this.resolvePublishedShop(slug);

    const [row] = await this.db
      .select({
        organizationId: organization.id,
        slug: organization.slug,
        name: organization.name,
        currency: organization.currency,
        template: storefrontSettings.template,
        theme: storefrontSettings.theme,
        seo: storefrontSettings.seo,
        checkout: storefrontSettings.checkout,
        pages: storefrontSettings.pages,
        customCss: storefrontSettings.customCss,
        published: storefrontSettings.published,
      })
      .from(organization)
      .innerJoin(storefrontSettings, eq(storefrontSettings.organizationId, organization.id))
      .where(eq(organization.id, organizationId))
      .limit(1);

    if (!row) throw new NotFoundException("Storefront not found.");

    // Seller CSS is rendered on a public page, so it is sanitised on the way out
    // rather than trusting whatever was stored.
    return {
      ...row,
      theme: sanitizeStorefrontTheme(row.theme),
      customCss: sanitizeStorefrontCss(row.customCss),
    };
  }
}

