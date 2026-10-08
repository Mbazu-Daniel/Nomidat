import type { PosCartItem, PosCartLineInput } from "./types/pos.type";

/**
 * Terminal-side cart maths. Advisory only: the server re-derives every minor-unit amount
 * at checkout, so rounding here only affects what the cashier sees on screen.
 */

/** Decimal places the till accepts on a line, matching `order_item.quantity`. */
const QUANTITY_DECIMALS = 3;

/**
 * Rounds a typed quantity to what the column and the DTO can hold.
 *
 * Three places is the contract, not a preference: Postgres *rounds* a fourth
 * decimal place rather than refusing it, so a quantity left unrounded would be
 * stored as a different number from the one the cashier saw and agreed to.
 */
export function normalizeQuantity(quantity: number): number {
  const factor = 10 ** QUANTITY_DECIMALS;
  return Math.round(quantity * factor) / factor;
}

/**
 * Two variants of one product are two separate lines, so identity is the pair.
 * A serialised line carries its serial into identity for the same reason: two
 * phones of one product are two lines, never a quantity of two.
 */
function lineKey(item: Pick<PosCartItem, "productId" | "variantId" | "serialNumberId">) {
  return `${item.productId}:${item.variantId ?? ""}:${item.serialNumberId ?? ""}`;
}

export function addCartItem(items: PosCartItem[], product: PosCartItem, step = 1): PosCartItem[] {
  const key = lineKey(product);
  // A named unit is already in the basket or it is not. Merging two different
  // serials into one line would sell a quantity the till cannot account for.
  if (product.serialNumberId) {
    return items.some((item) => lineKey(item) === key) ? items : [...items, product];
  }
  if (!items.some((item) => lineKey(item) === key))
    return [...items, { ...product, quantity: normalizeQuantity(step) }];

  return items.map((item) =>
    lineKey(item) === key ? { ...item, quantity: normalizeQuantity(item.quantity + step) } : item,
  );
}

export function setCartItemQuantity(
  items: PosCartItem[],
  productId: string,
  variantId: string | null,
  serialNumberId: string | null,
  quantity: number,
): PosCartItem[] {
  const key = `${productId}:${variantId ?? ""}:${serialNumberId ?? ""}`;
  if (quantity <= 0) return items.filter((item) => lineKey(item) !== key);
  return items.map((item) =>
    lineKey(item) === key ? { ...item, quantity: normalizeQuantity(quantity) } : item,
  );
}

export function removeCartItem(
  items: PosCartItem[],
  productId: string,
  variantId: string | null,
  serialNumberId: string | null,
): PosCartItem[] {
  const key = `${productId}:${variantId ?? ""}:${serialNumberId ?? ""}`;
  return items.filter((item) => lineKey(item) !== key);
}

export function summarizeCart(items: PosCartItem[]) {
  return {
    // A weighed line is 1.5 of something, so the count is rounded for display
    // rather than shown as a fraction of an item on a till screen.
    itemCount: Math.round(items.reduce((total, item) => total + item.quantity, 0)),
    // Rounded per line so the subtotal is the sum of the figures shown beside
    // each line, which is what the cashier adds up in their head.
    subtotalMinor: items.reduce(
      (total, item) => total + Math.round(item.quantity * item.unitPriceMinor),
      0,
    ),
  };
}

/** Mirrors the server's cart shape so a queued offline sale replays identically. */
export function toCartLineInput(items: PosCartItem[]): PosCartLineInput[] {
  return items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    quantity: item.quantity,
    // Omitted rather than sent null: an ordinary line carries no serial at all,
    // and the sale DTO models the absent case as an absent field.
    ...(item.serialNumberId ? { serialNumberIds: [item.serialNumberId] } : {}),
  }));
}

export function findCartItem(
  items: PosCartItem[],
  productId: string,
  variantId: string | null,
  serialNumberId: string | null = null,
) {
  return (
    items.find(
      (item) => lineKey(item) === `${productId}:${variantId ?? ""}:${serialNumberId ?? ""}`,
    ) ?? null
  );
}
