/** Basis points in a whole percentage; 10_000 bps = 100%. */
const BPS_PER_PERCENT = 100;

/**
 * Basis points in one whole unit; 10_000 bps = 100% of an amount.
 *
 * Converts a bps *rate* into the fraction of an amount it charges. Distinct from
 * `BPS_PER_PERCENT`, which converts a rate into the number Paystack's
 * `percentageCharge` expects — confusing the two overcharges by 100x.
 */
const BPS_PER_UNIT = 10_000;

/** The largest fee that can be set; 100% would leave a tenant nothing. */
export const MAX_BPS = 10_000;

/**
 * The platform's share of an amount, in minor units.
 *
 * The one place a fee is turned into money. Floor, so rounding the fee can never
 * take more than arrived, and the credit is always net of it.
 */
export function platformFeeMinor(amountMinor: number, platformFeeBps: number): number {
  return Math.floor((amountMinor * platformFeeBps) / BPS_PER_UNIT);
}

/**
 * The same rate as the number a payment provider's `percentageCharge` wants.
 *
 * A fraction, not an amount — `250bps` is 2.5, and passing `250` would charge a
 * hundred times the agreed fee.
 */
export function providerPercentageCharge(platformFeeBps: number): number {
  return platformFeeBps / BPS_PER_PERCENT;
}
