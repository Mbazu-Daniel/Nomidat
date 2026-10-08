import { BadRequestException } from "@nestjs/common";
import type { OrderMoneyLine, OrderTotals } from "./types/money.type";

/** One integer column of minor units cannot hold more than this. */
const MAX_MINOR = 2147483647;

/**
 * The price of one Order line, rounded to a whole minor unit.
 *
 * Rounded per line rather than summed and rounded once: a till that weighs produce
 * produces half-minor-unit lines, and rounding only the total would let the
 * displayed subtotal drift from the sum of its own figures.
 */
export function lineTotalMinor(line: OrderMoneyLine): number {
  return Math.round(line.quantity * line.unitPriceMinor);
}

/**
 * What an Order costs, from its lines and the business's own tax rate.
 *
 * The single place tax, discount and rounding are decided. A caller passes lines;
 * it never passes a tax figure, because a caller that can supply the tax can
 * charge whatever it likes.
 */
export function orderTotals(
  taxRateBps: number,
  lines: OrderMoneyLine[],
  discountMinor: number,
): OrderTotals {
  const subtotalMinor = lines.reduce((total, line) => total + lineTotalMinor(line), 0);
  const appliedDiscountMinor = Math.max(discountMinor, 0);

  if (!Number.isSafeInteger(subtotalMinor) || subtotalMinor > MAX_MINOR) {
    throw new BadRequestException("Sale exceeds the supported amount.");
  }
  // Refused rather than capped at the subtotal: a cap would silently sell for less
  // than the seller asked, and the total would then record a discount they never
  // agreed to.
  if (appliedDiscountMinor > subtotalMinor) {
    throw new BadRequestException("Discount cannot exceed the subtotal.");
  }

  const taxMinor = Math.round((subtotalMinor - appliedDiscountMinor) * taxRateBps / 10_000);
  const totalMinor = subtotalMinor - appliedDiscountMinor + taxMinor;

  if (totalMinor > MAX_MINOR) {
    throw new BadRequestException("Sale exceeds the supported amount.");
  }
  if (totalMinor <= 0) {
    throw new BadRequestException("The order total must be greater than zero.");
  }

  return { subtotalMinor, discountMinor: appliedDiscountMinor, taxMinor, totalMinor };
}