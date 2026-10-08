import { randomBytes } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, isNull, sql } from "@nomidat/db";
import { cart, cartItem } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { lineTotalMinor } from "../money/order-money";
import { SalePricingService } from "../sales/sale-pricing.service";
import { CartStatus } from "./types/storefront.type";

const CART_TTL_MINUTES = 60 * 24 * 14;
const MAX_LINES = 50;
const MAX_QUANTITY = 999;

/** A shopper's only credential, so it must be unguessable. */
export function createCartToken(): string {
  return randomBytes(32).toString("base64url");
}

export interface CartLineInput {
  productId: string;
  /** Omitted for a product with no variants. A variant is its own Stock Level. */
  variantId?: string;
  quantity: number;
}

/**
 * Anonymous shopping baskets. The token is the only credential a shopper has,
 * so every read and write is scoped by it *and* by organization — a token alone
 * must never be enough to reach another shop's basket.
 */
@Injectable()
export class StorefrontCartService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly pricing: SalePricingService,
  ) {}

  async openCart(organizationId: string, token?: string) {
    if (token) {
      const existing = await this.getOpenCartByToken(organizationId, token);
      if (existing) return this.getCart(organizationId, existing.id);
    }

    const [created] = await this.db
      .insert(cart)
      .values({
        organizationId,
        token: token ?? createCartToken(),
        expiresAt: new Date(Date.now() + CART_TTL_MINUTES * 60_000),
      })
      .returning();

    return { ...created, items: [], itemCount: 0, subtotalMinor: 0, totalMinor: 0 };
  }

  async addItem(organizationId: string, token: string, line: CartLineInput) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY) {
      throw new BadRequestException("Quantity must be a whole number between 1 and 999.");
    }

    const existing = await this.requireCart(organizationId, token);

    // Priced through the same seam a till uses. A shopper cannot post a price of
    // their own choosing, and a product pulled from sale mid-visit is refused here
    // rather than sitting in a basket until checkout.
    const [priced] = await this.pricing.priceLines(organizationId, [
      { productId: line.productId, variantId: line.variantId ?? null, quantity: line.quantity },
    ]);

    // Identity is the product *and* the option, so two sizes stay two lines.
    const [alreadyInCart] = await this.db
      .select()
      .from(cartItem)
      .where(
        and(
          eq(cartItem.cartId, existing.id),
          eq(cartItem.productId, line.productId),
          line.variantId ? eq(cartItem.variantId, line.variantId) : isNull(cartItem.variantId),
        ),
      )
      .limit(1);

    if (alreadyInCart) {
      await this.db
        .update(cartItem)
        .set({ quantity: Math.min(alreadyInCart.quantity + line.quantity, MAX_QUANTITY) })
        .where(eq(cartItem.id, alreadyInCart.id));
    } else {
      const [{ total }] = await this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(cartItem)
        .where(eq(cartItem.cartId, existing.id));
      if (Number(total ?? 0) >= MAX_LINES) {
        throw new BadRequestException("Your basket has too many items.");
      }

      await this.db.insert(cartItem).values({
        organizationId,
        cartId: existing.id,
        productId: line.productId,
        variantId: line.variantId ?? null,
        // The snapshot so a basket still renders if the product is later renamed.
        // Checkout re-prices through the sale seam and ignores this figure.
        productName: priced.productName,
        unitPriceMinor: priced.unitPriceMinor,
        quantity: line.quantity,
      });
    }

    return this.getCart(organizationId, existing.id);
  }

  async getCartByToken(organizationId: string, token: string) {
    const existing = await this.requireCart(organizationId, token);
    return this.getCart(organizationId, existing.id);
  }

  /** Totals are always recomputed from the stored lines, never trusted from a request. */
  async getCart(organizationId: string, cartId: string) {
    const [record] = await this.db
      .select()
      .from(cart)
      .where(and(eq(cart.id, cartId), eq(cart.organizationId, organizationId)))
      .limit(1);
    if (!record) throw new NotFoundException("Basket not found.");

    const items = await this.db
      .select()
      .from(cartItem)
      .where(eq(cartItem.cartId, cartId))
      .orderBy(cartItem.createdAt);

    // Rounded per line by the same rule the sale uses, so the basket total a
    // shopper reads is the figure the order will record.
    const subtotalMinor = items.reduce((total, item) => total + lineTotalMinor(item), 0);

    return {
      id: record.id,
      token: record.token,
      status: record.status,
      items,
      subtotalMinor,
      totalMinor: subtotalMinor,
      currency: record.currency,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
    };
  }

  /** Marks a basket converted so a replayed checkout cannot create a second order. */
  async markConverted(organizationId: string, cartId: string, orderId: string) {
    await this.db
      .update(cart)
      .set({ status: CartStatus.CONVERTED, convertedOrderId: orderId, updatedAt: new Date() })
      .where(
        and(
          eq(cart.id, cartId),
          eq(cart.organizationId, organizationId),
          isNull(cart.convertedOrderId),
        ),
      );
  }

  /**
   * The open basket for a shopper token, or null. Distinct from `getCart`,
   * which fetches by id — a token is not an id and must not be interchangeable.
   */
  private async getOpenCartByToken(organizationId: string, token: string) {
    const [row] = await this.db
      .select()
      .from(cart)
      .where(
        and(
          eq(cart.organizationId, organizationId),
          eq(cart.token, token),
          eq(cart.status, CartStatus.OPEN),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  private async requireCart(organizationId: string, token: string) {
    const found = await this.getOpenCartByToken(organizationId, token);
    if (!found) throw new NotFoundException("Basket not found or has expired.");
    if (found.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException("Basket not found or has expired.");
    }
    return found;
  }
}
