/** What money means for one business: its currency and its sales tax rate. */
export interface MoneyPolicy {
  /** ISO 4217 code, e.g. NGN, USD, GBP. */
  currency: string;
  /** Sales tax in basis points, e.g. 750 for 7.5%. */
  taxRateBps: number;
}

/** The smallest thing money arithmetic needs to know about an Order line. */
export interface OrderMoneyLine {
  quantity: number;
  unitPriceMinor: number;
}

/**
 * What an Order costs. Every figure is in minor units, and every one of them is
 * derived here so the till, the shop assistant and the books cannot disagree.
 */
export interface OrderTotals {
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
}

/** Order totals plus the policy they were derived from, for the Order row. */
export interface PolicyOrderTotals extends OrderTotals {
  currency: string;
}
