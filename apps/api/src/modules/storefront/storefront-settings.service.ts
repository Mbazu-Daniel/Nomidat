import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "@nomidat/db";
import {
  STOREFRONT_TEMPLATES,
  organization,
  storefrontSettings,
  type StorefrontTemplate,
} from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { sanitizeStorefrontCss } from "./sanitize-css";
import { sanitizeStorefrontTheme } from "./types/storefront.type";

/** Keeps a seller-authored stylesheet and note fields from growing without bound. */
export const MAX_CUSTOM_CSS_LENGTH = 20_000;
export const MAX_STOREFRONT_PAGE_BYTES = 8_000;

@Injectable()
export class StorefrontSettingsService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  /**
   * Creates the settings row on first read, so a brand-new organization always has
   * something to edit rather than a page that cannot save because no row exists.
   * New storefronts are created unpublished.
   */
  async getOrCreate(organizationId: string) {
    const [existing] = await this.db
      .select()
      .from(storefrontSettings)
      .where(eq(storefrontSettings.organizationId, organizationId))
      .limit(1);

    if (existing) return existing;

    const [created] = await this.db
      .insert(storefrontSettings)
      .values({ organizationId })
      .onConflictDoNothing()
      .returning();

    if (created) return created;

    // A concurrent request won the insert; read what it wrote.
    const [raced] = await this.db
      .select()
      .from(storefrontSettings)
      .where(eq(storefrontSettings.organizationId, organizationId))
      .limit(1);
    if (!raced) throw new NotFoundException("Storefront settings could not be created.");
    return raced;
  }

  /**
   * Seller view of the shop's public identity: what is published, at which
   * addresses, and whether each address is proven.
   */
  async getOverview(organizationId: string) {
    const settings = await this.getOrCreate(organizationId);
    const [org] = await this.db
      .select({ slug: organization.slug, name: organization.name, currency: organization.currency })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);

    return {
      slug: org?.slug ?? null,
      name: org?.name ?? null,
      currency: org?.currency ?? "NGN",
      published: settings.published,
      template: settings.template,
      theme: settings.theme,
      seo: settings.seo,
      // Returned sanitized so the editor shows exactly what shoppers receive,
      // not what was typed.
      customCss: sanitizeStorefrontCss(settings.customCss),
      updatedAt: settings.updatedAt,
    };
  }

  /**
   * Applies a partial update. Theme and CSS are sanitized before they are stored
   * as well as before they are served: storing something that will be silently
   * stripped later makes the editor lie about what the shop actually looks like.
   */
  async update(
    organizationId: string,
    input: {
      published?: boolean;
      template?: string;
      theme?: Record<string, unknown>;
      customCss?: string | null;
      seo?: Record<string, unknown>;
    },
  ) {
    await this.getOrCreate(organizationId);

    const patch: Partial<typeof storefrontSettings.$inferInsert> = { updatedAt: new Date() };

    if (input.published !== undefined) {
      patch.published = input.published;
    }

    if (input.template !== undefined) {
      if (!(STOREFRONT_TEMPLATES as readonly string[]).includes(input.template)) {
        throw new BadRequestException(
          `Template must be one of: ${STOREFRONT_TEMPLATES.join(", ")}.`,
        );
      }
      patch.template = input.template as StorefrontTemplate;
    }

    if (input.theme !== undefined) {
      patch.theme = sanitizeStorefrontTheme(input.theme) as Record<string, unknown>;
    }

    if (input.customCss !== undefined) {
      if (input.customCss && input.customCss.length > MAX_CUSTOM_CSS_LENGTH) {
        throw new BadRequestException("That stylesheet is too long.");
      }
      patch.customCss = input.customCss ? sanitizeStorefrontCss(input.customCss) : null;
    }

    if (input.seo !== undefined) {
      const serialized = JSON.stringify(input.seo);
      if (serialized.length > MAX_STOREFRONT_PAGE_BYTES) {
        throw new BadRequestException("SEO settings are too large.");
      }
      patch.seo = input.seo;
    }

    const [updated] = await this.db
      .update(storefrontSettings)
      .set(patch)
      .where(eq(storefrontSettings.organizationId, organizationId))
      .returning();

    if (!updated) throw new NotFoundException("Storefront settings not found.");

    return {
      published: updated.published,
      template: updated.template,
      theme: updated.theme,
      seo: updated.seo,
      customCss: sanitizeStorefrontCss(updated.customCss),
      updatedAt: updated.updatedAt,
    };
  }
}
