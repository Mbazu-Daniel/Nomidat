import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray } from "@nomidat/db";
import { product, productVariant } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { lineTotalMinor } from "../money/order-money";
import type { PricedSaleLine, SaleRequestLine } from "./types/sales.type";

/**
 * What each line of a Sale actually is, and what it costs.
 *
 * One resolver behind the Sale intake seam, so a till, a public shop and the
 * assistant cannot drift apart on a Product's price, its name, or when it stops
 * being sellable. Price and identity are read here rather than taken from the
 * request: a basket can live for a fortnight, and a caller that supplies its own
 * price supplies its own price.
 *
 * An ad-hoc line — one the seller named that is not in the catalog — keeps the
 * name and price the seller typed. That is the only case where a caller's figure
 * wins, because there is nothing on file to prefer.
 */
@Injectable()
export class SalePricingService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  async priceLines(organizationId: string, items: SaleRequestLine[]): Promise<PricedSaleLine[]> {
    const catalog = await this.readCatalog(organizationId, items);

    return items.map((item) => {
      if (item.productId === undefined) {
        if (item.unitPriceMinor === undefined) {
          throw new BadRequestException("An item needs a productId or a unitPriceMinor.");
        }
        return {
          productName: item.productName ?? "Item",
          productSku: null,
          quantity: item.quantity,
          unitPriceMinor: item.unitPriceMinor,
          lineTotalMinor: lineTotalMinor({ quantity: item.quantity, unitPriceMinor: item.unitPriceMinor }),
        };
      }

      const productId = item.productId;
      const found = catalog.products.get(productId);
      if (!found) throw new BadRequestException("Product not found.");
      if (!found.isActive) throw new ConflictException("Product is archived and cannot be sold.");

      // A variant must belong to the product it was sold under, or a caller could
      // name any variant they like and have its price applied to another product.
      const variant = item.variantId ? catalog.variants.get(item.variantId) : undefined;
      if (item.variantId && (!variant || variant.productId !== productId)) {
        throw new BadRequestException("That variant does not belong to this product.");
      }
      if (variant && !variant.isActive) {
        throw new ConflictException("That variant is archived and cannot be sold.");
      }

      const unitPriceMinor = variant?.priceMinor || found.priceMinor;
      return {
        productId,
        // Absent rather than null: the DTO models "no variant" as an absent field.
        variantId: variant?.id ?? undefined,
        productName: variant?.name ? `${found.name} · ${variant.name}` : found.name,
        productSku: variant?.sku ?? found.sku,
        quantity: item.quantity,
        unitPriceMinor,
        lineTotalMinor: lineTotalMinor({ quantity: item.quantity, unitPriceMinor }),
        serialNumberIds: item.serialNumberIds,
      };
    });
  }

  /**
   * Two reads whatever the basket size: every named Product, then every named
   * variant. One round trip each beats one per line.
   */
  private async readCatalog(organizationId: string, items: SaleRequestLine[]) {
    const productIds: string[] = [];
    for (const item of items) if (item.productId) productIds.push(item.productId);
    const uniqueProductIds = [...new Set(productIds)];
    const products =
      uniqueProductIds.length === 0
        ? []
        : await this.db
            .select({
              id: product.id,
              name: product.name,
              sku: product.sku,
              priceMinor: product.priceMinor,
              isActive: product.isActive,
            })
            .from(product)
            .where(
              and(eq(product.organizationId, organizationId), inArray(product.id, uniqueProductIds)),
            );

    const variantIds = [
      ...new Set(items.flatMap((item) => (item.variantId ? [item.variantId] : []))),
    ];
    const variants =
      variantIds.length === 0
        ? []
        : await this.db
            .select({
              id: productVariant.id,
              productId: productVariant.productId,
              name: productVariant.name,
              sku: productVariant.sku,
              priceMinor: productVariant.priceMinor,
              isActive: productVariant.isActive,
            })
            .from(productVariant)
            .where(
              and(
                eq(productVariant.organizationId, organizationId),
                inArray(productVariant.id, variantIds),
              ),
            );

    return {
      products: new Map(products.map((row) => [row.id, row])),
      variants: new Map(variants.map((row) => [row.id, row])),
    };
  }
}