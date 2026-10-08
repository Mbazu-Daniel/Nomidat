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
}

export type PosPaymentMethod = "cash" | "bank_transfer" | "card";

export interface PosCartLineInput {
  productId: string;
  variantId: string | null;
  quantity: number;
  serialNumberIds?: string[];
}

export const POS_PAYMENT_METHODS: { value: PosPaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "card", label: "Card" },
];
