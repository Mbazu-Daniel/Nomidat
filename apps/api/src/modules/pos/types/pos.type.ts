/** How a counter sale settles. Cash is immediate; the rest wait for a provider. */
export const POS_PAYMENT_METHODS = {
  CASH: "cash",
  BANK_TRANSFER: "bank_transfer",
  CARD: "card",
} as const;
export type PosPaymentMethod = (typeof POS_PAYMENT_METHODS)[keyof typeof POS_PAYMENT_METHODS];

export const POS_DEFAULT_PAYMENT_METHOD = POS_PAYMENT_METHODS.CASH;

/** Methods that can only settle once a payment provider confirms. */
export const ONLINE_POS_PAYMENT_METHODS: ReadonlySet<PosPaymentMethod> = new Set([
  POS_PAYMENT_METHODS.BANK_TRANSFER,
  POS_PAYMENT_METHODS.CARD,
]);

/** Channel a sale was created by, matching the Order source vocabulary. */
const ORDER_SOURCES = ["manual", "online", "pos"] as const;
type OrderSource = (typeof ORDER_SOURCES)[number];

/** Lifecycle of an order. */
const ORDER_STATUSES = ["pending", "paid", "cancelled", "refunded"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Two variants of one product are two lines, so identity is the pair. */
function cartLineKey(line: { productId: string; variantId?: string | null }) {
  return `${line.productId}:${line.variantId ?? ""}`;
}

/** What the till reads back after a sale: the priced figures plus the change due. */
export interface PosCheckoutTotals {
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  changeMinor: number;
}
