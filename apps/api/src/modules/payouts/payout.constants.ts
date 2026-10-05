/** Basis points in a whole percentage; 10_000 bps = 100%. */
export const BPS_PER_PERCENT = 100;

/**
 * Basis points in one whole unit; 10_000 bps = 100% of an amount.
 *
 * Converts a bps *rate* into the fraction of an amount it charges. Distinct from
 * `BPS_PER_PERCENT`, which converts a rate into the number Paystack's
 * `percentageCharge` expects — confusing the two overcharges by 100x.
 */
export const BPS_PER_UNIT = 10_000;

/** The largest fee that can be set; 100% would leave a tenant nothing. */
export const MAX_BPS = 10_000;
