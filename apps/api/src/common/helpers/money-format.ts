/**
 * Money as words a person can read, and back again.
 *
 * One digit table for the whole API: `MoneyPolicyService` derives its scale from
 * it, so a currency recorded here is immediately right for tax, for parsing a
 * typed amount, and for every sentence that quotes one. The web tier carries the
 * same eleven numbers in `apps/web/src/lib/money.ts` — there is no package both
 * tiers already depend on that could hold one copy, so keep the two in step.
 */

/** How many digits a currency's minor unit has. Yen and won have none. */
const MINOR_UNIT_DIGITS: Record<string, number> = {
  NGN: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  ZAR: 2,
  KES: 2,
  GHS: 2,
  INR: 2,
  JPY: 0,
  KRW: 0,
  VND: 0,
};

export function minorUnitDigits(currency: string): number {
  return MINOR_UNIT_DIGITS[currency.toUpperCase()] ?? 2;
}

/** Minor units in one whole unit: 100 for naira, 1 for yen. */
export function minorUnitScale(currency: string): number {
  return 10 ** minorUnitDigits(currency);
}

/**
 * An amount with its currency symbol, e.g. `₦1,500.00`.
 *
 * Used for anything a person reads rather than a machine parses — the sentence a
 * seller gets back from the assistant, the line on a receipt.
 */
export function formatMinorAmount(minorUnits: number, currency: string, locale = "en-NG"): string {
  const digits = minorUnitDigits(currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(minorUnits / 10 ** digits);
}

/**
 * An amount as plain digits, e.g. `1,500.00`, for putting after a currency code.
 *
 * Invoices and channel messages name the currency themselves, so the symbol
 * would say the same thing twice — but the *scale* still has to come from the
 * currency, which is the whole point of this existing.
 */
export function minorAmountPlain(minorUnits: number, currency: string, locale = "en-NG"): string {
  const digits = minorUnitDigits(currency);
  return (minorUnits / 10 ** digits).toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * A whole-unit figure — a prompt's "50", a receipt's total — in minor units.
 *
 * Rounding rather than truncating: 19.99 × 100 is 1998.9999999999998 in
 * floating point, and truncating it would short-change the record by a kobo.
 */
export function majorToMinor(major: number, currency: string): number {
  return Math.round(major * minorUnitScale(currency));
}
