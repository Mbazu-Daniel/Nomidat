/**
 * Shared money rendering. Amounts arrive as integers in the currency's minor
 * unit, so nothing here assumes a hundredth and no caller hardcodes a symbol.
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

/**
 * Parses a human-typed amount into minor units, or null when it is not a number.
 *
 * The scale comes from the currency rather than a fixed divide-by-100, which
 * would be wrong for a currency that has no hundredths.
 */
export function parseMoneyToMinor(input: string, currency: string): number | null {
  const trimmed = input.trim();
  if (!trimmed || !/^\d*\.?\d*$/.test(trimmed)) return null;

  const digits = minorUnitDigits(currency);
  const [whole = "", fraction = ""] = trimmed.split(".");
  if (fraction.length > digits) return null;

  const minorFraction = fraction.padEnd(digits, "0");
  const value = Number(`${whole || "0"}${minorFraction}`);
  return Number.isFinite(value) ? value : null;
}

export function formatMoney(minorUnits: number, currency = "NGN", locale = "en-NG"): string {
  const digits = minorUnitDigits(currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(minorUnits / 10 ** digits);
}

/**
 * A minor-unit amount as a plain decimal string, for putting into a number input.
 *
 * `formatMoney` cannot be used here: it renders a symbol and thousands
 * separators, none of which parse back. A fixed `/ 100` is what this replaces —
 * wrong for any currency without hundredths, and it rounds, so an amount read out
 * and saved again would come back changed.
 */
export function minorToDecimalInput(minorUnits: number, currency = "NGN"): string {
  const digits = minorUnitDigits(currency);
  return (minorUnits / 10 ** digits).toFixed(digits);
}
