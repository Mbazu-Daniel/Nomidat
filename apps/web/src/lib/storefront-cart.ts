import { addToStoreCart, getStoreCart, openStoreCart, type StoreCart } from "@/data/storefront";

/**
 * The shopper's basket token, held in localStorage because it is their only
 * credential — there is no shopper account to hang a server session off.
 *
 * Defined once here: the product page and the checkout page must agree on the
 * key, or adding from one would not show up in the other.
 */
const TOKEN_KEY = "nomidat:storefront:cart";

export function readCartToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(TOKEN_KEY) ?? undefined;
}

export function writeCartToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearCartToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

/**
 * Resumes the shopper's basket, opening one if they have none.
 *
 * A stale token — an expired or already-converted basket — is discarded and
 * replaced rather than surfaced as an error, because the shopper did nothing
 * wrong and simply wants to buy something.
 */
export async function resumeCart(slug: string): Promise<StoreCart> {
  const existing = readCartToken();
  if (existing) {
    try {
      const cart = await getStoreCart(slug, existing);
      writeCartToken(cart.token);
      return cart;
    } catch {
      clearCartToken();
    }
  }
  const cart = await openStoreCart(slug);
  writeCartToken(cart.token);
  return cart;
}

/** Adds a product to the shopper's basket, opening one if needed. */
export async function addProductToCart(
  slug: string,
  productId: string,
  quantity = 1,
  variantId?: string,
): Promise<StoreCart> {
  const cart = await resumeCart(slug);
  const next = await addToStoreCart(slug, cart.token, productId, quantity, variantId);
  writeCartToken(next.token);
  return next;
}
