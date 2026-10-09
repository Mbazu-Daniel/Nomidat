export interface PosCartItem {
  productId: string;
  /** Present only when the product has variants. Identity is the pair, not the product. */
  variantId: string | null;
  name: string;
  sku: string | null;
  unitPriceMinor: number;
  quantity: number;
  /**
   * The unit this line sells, when the product is tracked by serial. A serial is
   * one physical item, so a serialised line is always one long and never stacks.
   */
  serialNumberId: string | null;
  /** Shown on the line so the cashier can read back which unit is being sold. */
  serialCode: string | null;
  /** This line's own instruction, such as "extra spicy" or "no onions". */
  note: string;
}

export type PosPaymentMethod = "cash" | "bank_transfer" | "card";

/**
 * How the customer receives the order. Recorded on the sale so a report can
 * answer "how many deliveries today" — which is why it is not screen-only state.
 */
export type PosFulfilmentType = "dine_in" | "takeaway" | "delivery";

export interface PosCartLineInput {
  productId: string;
  variantId: string | null;
  quantity: number;
  serialNumberIds?: string[];
  note?: string;
}

export const POS_PAYMENT_METHODS: { value: PosPaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "card", label: "Card" },
];

export const POS_FULFILMENT_TYPES: { value: PosFulfilmentType; label: string }[] = [
  { value: "dine_in", label: "Dine in" },
  { value: "takeaway", label: "Takeaway" },
  { value: "delivery", label: "Delivery" },
];
