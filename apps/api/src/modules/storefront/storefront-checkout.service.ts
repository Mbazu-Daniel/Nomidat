import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray } from "@nomidat/db";
import { product, productVariant } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { SalesService } from "../sales/sales.service";
import { CartStatus } from "./types/storefront.type";
import { StorefrontCartService } from "./storefront-cart.service";
import { StorefrontResolver } from "./storefront-resolver.service";
import type { StorefrontCheckoutDto } from "./dto/storefront-checkout.dto";

/**
 * Turns a basket into an order. Deliberately routes through the same SalesService
 * the counter uses, so a storefront sale decrements stock and writes its ledger
 * row exactly like a till sale — there is no second way to sell.
 */
@Injectable()
export class StorefrontCheckoutService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly carts: StorefrontCartService,
    private readonly sales: SalesService,
    private readonly resolver: StorefrontResolver,
  ) {}

  async checkout(slug: string, dto: StorefrontCheckoutDto) {
    const config = await this.resolver.getPublicConfig(slug);
    const basket = await this.carts.getCartByToken(config.organizationId, dto.cartToken);

    if (basket.status === CartStatus.CONVERTED) {
      throw new BadRequestException("This order has already been placed.");
    }
    if (!basket.items.length) throw new BadRequestException("Your basket is empty.");

    const priced = await this.priceBasket(config.organizationId, basket.items);

    const sale = await this.sales.createSale(config.organizationId, null, {
      source: "online",
      items: priced.map((line) => ({
        productId: line.productId,
        // Without this the order line names only the product, and the stock
        // movement would draw down the wrong Stock Level for a variant.
        variantId: line.variantId ?? undefined,
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor,
        lineTotalMinor: line.quantity * line.unitPriceMinor,
      })),
      // A storefront order is unpaid until the shopper actually pays.
      paymentAmountMinor: 0,
      paymentMethod: dto.paymentMethod ?? "cash",
      paymentReference: dto.paymentReference,
      // The token is the idempotency key, so a double submit cannot charge twice.
      clientReference: `storefront:${dto.cartToken}`,
      notes: [dto.customerName, dto.customerPhone, dto.deliveryAddress]
        .filter(Boolean)
        .join(" · ") || undefined,
    });

    await this.carts.markConverted(config.organizationId, basket.id, sale.id);

    return { orderId: sale.id, status: sale.status, totalMinor: sale.totalMinor };
  }

  /**
   * Re-reads every basket line from the database at the moment of checkout.
   *
   * The cart snapshots a price so the basket still renders if the product
   * changes, but a basket can live for a fortnight. Recording that snapshot
   * would let a shopper hold yesterday's price, so the sale records today's.
   */
  private async priceBasket(
    organizationId: string,
    items: Array<{ productId: string; variantId: string | null; quantity: number }>,
  ) {
    const productIds = [...new Set(items.map((item) => item.productId))];
    const rows = await this.db
      .select({
        id: product.id,
        priceMinor: product.priceMinor,
        isActive: product.isActive,
      })
      .from(product)
      .where(and(eq(product.organizationId, organizationId), inArray(product.id, productIds)));
    const prices = new Map(rows.map((row) => [row.id, row]));

    const variantIds = items.flatMap((item) => (item.variantId ? [item.variantId] : []));
    const variantRows =
      variantIds.length === 0
        ? []
        : await this.db
            .select({
              id: productVariant.id,
              productId: productVariant.productId,
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
    const variants = new Map(variantRows.map((row) => [row.id, row]));

    return items.map((item) => {
      const found = prices.get(item.productId);
      // A product pulled from sale mid-basket must not be bought at a stale price.
      if (!found || !found.isActive) {
        throw new BadRequestException("An item in your basket is no longer available.");
      }
      const variant = item.variantId ? variants.get(item.variantId) : undefined;
      if (item.variantId && (!variant || variant.productId !== item.productId)) {
        throw new BadRequestException("An option in your basket is no longer available.");
      }
      if (variant && !variant.isActive) {
        throw new BadRequestException("An option in your basket is no longer available.");
      }

      return {
        productId: item.productId,
        variantId: variant?.id ?? null,
        quantity: item.quantity,
        unitPriceMinor: variant?.priceMinor || found.priceMinor,
      };
    });
  }
}
