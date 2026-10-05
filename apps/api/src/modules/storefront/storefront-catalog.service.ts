import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, gte, ilike, inArray, sql } from "@nomidat/db";
import { product, productCategory, productCategoryAssignment, productVariant, stock } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { StorefrontResolver } from "./storefront-resolver.service";

const MAX_LIMIT = 60;

export interface PublishedProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceMinor: number;
  inStock: boolean;
  categoryIds: string[];
  /** Sellable options, empty for a product that has none. */
  variants: PublishedVariant[];
}

export interface PublishedVariant {
  id: string;
  name: string;
  /** The variant's own price when it has one, otherwise the product price. */
  priceMinor: number;
  inStock: boolean;
}

/** Read-only catalog for shoppers. Never exposes cost, supplier or stock counts. */
@Injectable()
export class StorefrontCatalogService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly resolver: StorefrontResolver,
  ) {}

  async getCategories(slug: string) {
    return this.resolveCategories((await this.resolver.resolvePublishedShop(slug)).organizationId);
  }

  private async resolveCategories(organizationId: string) {
    return this.db
      .select({
        id: productCategory.id,
        name: productCategory.name,
        slug: productCategory.slug,
      })
      .from(productCategory)
      .where(
        and(
          eq(productCategory.organizationId, organizationId),
          eq(productCategory.isActive, true),
        ),
      )
      .orderBy(productCategory.name);
  }

  /**
   * Published products with a stock flag. Stock is reduced to a boolean on
   * purpose: a shopper should know whether it is buyable, not how deep the
   * seller's shelves are.
   */
  async getProducts(
    slug: string,
    options: { search?: string; categoryId?: string; limit?: number; offset?: number } = {},
  ) {
    const organizationId = (await this.resolver.resolvePublishedShop(slug)).organizationId;

    const conditions = [
      eq(product.organizationId, organizationId),
      eq(product.isActive, true),
      gte(product.priceMinor, 0),
    ];
    if (options.search) conditions.push(ilike(product.name, `%${options.search}%`));
    if (options.categoryId) {
      const members = await this.db
        .select({ productId: productCategoryAssignment.productId })
        .from(productCategoryAssignment)
        .where(eq(productCategoryAssignment.categoryId, options.categoryId));
      const ids = members.map((row) => row.productId);
      // No matches must yield an empty page, never the whole catalog.
      if (!ids.length) return [];
      conditions.push(inArray(product.id, ids));
    }

    return this.db
      .select({
        id: product.id,
        name: product.name,
        description: product.description,
        priceMinor: product.priceMinor,
        sku: product.sku,
        unit: product.unit,
        inStock: sql<boolean>`coalesce((select sum(${stock.onHand}) from ${stock} where ${stock.productId} = ${product.id} and ${stock.organizationId} = ${organizationId}) > 0, false)`,
      })
      .from(product)
      .where(and(...conditions))
      .orderBy(desc(product.updatedAt))
      .limit(Math.min(Math.max(options.limit ?? 24, 1), MAX_LIMIT))
      .offset(Math.max(options.offset ?? 0, 0));
  }

  async getProduct(slug: string, productId: string): Promise<PublishedProduct> {
    const organizationId = (await this.resolver.resolvePublishedShop(slug)).organizationId;

    const [row] = await this.db
      .select({
        id: product.id,
        name: product.name,
        description: product.description,
        priceMinor: product.priceMinor,
        sku: product.sku,
        unit: product.unit,
        isActive: product.isActive,
        inStock: sql<boolean>`coalesce((select sum(${stock.onHand}) from ${stock} where ${stock.productId} = ${product.id} and ${stock.organizationId} = ${organizationId}) > 0, false)`,
      })
      .from(product)
      .where(and(eq(product.id, productId), eq(product.organizationId, organizationId)))
      .limit(1);

    if (!row || !row.isActive) throw new NotFoundException("Product not found.");

    const categories = await this.db
      .select({ categoryId: productCategoryAssignment.categoryId })
      .from(productCategoryAssignment)
      .where(eq(productCategoryAssignment.productId, productId));

    // Stock is per variant, so availability is read per variant rather than
    // assumed from the product total. Price and count are never exposed.
    const variantRows = await this.db
      .select({
        id: productVariant.id,
        name: productVariant.name,
        priceMinor: productVariant.priceMinor,
        inStock: sql<boolean>`coalesce((select sum(${stock.onHand}) from ${stock} where ${stock.productId} = ${productVariant.productId} and ${stock.variantId} = ${productVariant.id} and ${stock.organizationId} = ${organizationId}) > 0, false)`,
      })
      .from(productVariant)
      .where(
        and(
          eq(productVariant.organizationId, organizationId),
          eq(productVariant.productId, productId),
          eq(productVariant.isActive, true),
        ),
      )
      .orderBy(asc(productVariant.name));

    const variants: PublishedVariant[] = variantRows.map((variant) => ({
      id: variant.id,
      name: variant.name,
      priceMinor: variant.priceMinor || row.priceMinor,
      inStock: variant.inStock,
    }));

    return {
      id: row.id,
      name: row.name,
      slug: row.id,
      description: row.description,
      priceMinor: row.priceMinor,
      inStock: row.inStock,
      categoryIds: categories.map((entry) => entry.categoryId),
      variants,
    };
  }
}
