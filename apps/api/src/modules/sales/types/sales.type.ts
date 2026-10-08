/**
 * Everything about a Sale that is not its lines or its totals: who it is for, how
 * it is being paid, and how a replay of it is recognised. The writer needs this
 * separate from the priced lines so it cannot re-read anything the seams decided.
 */
export interface SaleOrderInput {
  customerId?: string;
  source?: "manual" | "online" | "pos";
  paymentMethod?: string;
  paymentProvider?: string;
  paymentReference?: string;
  clientReference?: string;
  notes?: string;
}

/** A line as a caller states it: what was asked for, and at what price. */
export interface SaleRequestLine {
  /** Absent for an ad-hoc line the seller named themselves. */
  productId?: string;
  /** Absent for a Product with no variants. A variant is its own Stock Level. */
  variantId?: string | null;
  /** Ad-hoc lines only; a catalogued line's price is read, never trusted. */
  unitPriceMinor?: number;
  quantity: number;
  /** Only an ad-hoc line has one. */
  productName?: string;
  serialNumberIds?: string[];
}

/**
 * A line with its identity and price decided by the server, ready to become an
 * Order line. An ad-hoc line has no `productId`, so `productName` carries it.
 */
export interface PricedSaleLine {
  productId?: string;
  variantId?: string;
  productName: string;
  productSku: string | null;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  discountMinor?: number;
  serialNumberIds?: string[];
}

/** What an Order costs, as the Order writer needs it. */
export interface SaleTotals {
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  paymentAmountMinor: number;
}