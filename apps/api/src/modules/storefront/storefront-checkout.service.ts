import { BadRequestException, Injectable } from "@nestjs/common";
import { SalesService } from "../sales/sales.service";
import { CartStatus } from "./types/storefront.type";
import { StorefrontCartService } from "./storefront-cart.service";
import { StorefrontResolver } from "./storefront-resolver.service";
import type { StorefrontCheckoutDto } from "./dto/storefront-checkout.dto";

/**
 * Turns a basket into an order. Deliberately routes through the same SalesService
 * the counter uses, so a storefront sale is priced, taxed, decrements stock and
 * writes its ledger row exactly like a till sale — there is no second way to sell.
 */
@Injectable()
export class StorefrontCheckoutService {
  constructor(
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

    /*
     * Priced through the same seam a till uses, from the basket's stored lines
     * rather than its snapshot price: a basket can live for a fortnight, and
     * recording the snapshot would let a shopper hold yesterday's price.
     */
    const sale = await this.sales.createSale(config.organizationId, null, {
      source: "online",
      // Only what was asked for. Price, name and sellability are the sale seams'
      // to decide, so a basket's own snapshot price cannot become the recorded one.
      items: basket.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? undefined,
        quantity: item.quantity,
      })),
      // A storefront order is unpaid until the shopper actually pays.
      paymentAmountMinor: 0,
      paymentMethod: dto.paymentMethod ?? "cash",
      paymentReference: dto.paymentReference,
      // The token is the idempotency key, so a double submit cannot charge twice.
      clientReference: `storefront:${dto.cartToken}`,
      notes:
        [dto.customerName, dto.customerPhone, dto.deliveryAddress].filter(Boolean).join(" · ") ||
        undefined,
    });

    await this.carts.markConverted(config.organizationId, basket.id, sale.id);

    return { orderId: sale.id, status: sale.status, totalMinor: sale.totalMinor };
  }

  }
