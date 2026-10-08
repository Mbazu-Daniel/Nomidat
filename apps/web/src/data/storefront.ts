import { createApiRequest } from "@/lib/api";

const PUBLIC = "/public/storefront";

/** A shop theme, already narrowed by the API to known colour tokens. */
export type StorefrontTheme = {
  accent?: string;
  background?: string;
  surface?: string;
  text?: string;
  muted?: string;
};

export interface StorefrontConfig {
  organizationId: string;
  slug: string;
  name: string;
  currency: string;
  template: "minimal" | "catalog" | "boutique";
  theme: StorefrontTheme;
  seo: Record<string, unknown>;
  checkout: Record<string, unknown>;
  pages: Record<string, unknown>;
  customCss: string | null;
}

/**
 * Stands in for a config that has not arrived, so the product and checkout pages
 * render their shell immediately. The shop home takes its config from the route
 * loader instead and shows "shop unavailable" when there is none.
 */
export const EMPTY_STOREFRONT_CONFIG: StorefrontConfig = {
  organizationId: "",
  slug: "",
  name: "",
  currency: "NGN",
  template: "minimal",
  theme: {},
  seo: {},
  checkout: {},
  pages: {},
  customCss: null,
};

export interface StoreProduct {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  sku: string | null;
  unit: string;
  inStock: boolean;
  /** Sellable options; empty for a product that has none. */
  variants: StoreVariant[];
}

export interface StoreVariant {
  id: string;
  name: string;
  priceMinor: number;
  inStock: boolean;
}

export interface StoreCart {
  token: string;
  items: {
    id: string;
    productId: string;
    variantId: string | null;
    productName: string;
    unitPriceMinor: number;
    quantity: number;
  }[];
  subtotalMinor: number;
  totalMinor: number;
  itemCount: number;
  currency: string;
}

export function getStorefrontConfig(slug: string) {
  return createApiRequest<StorefrontConfig>(`${PUBLIC}/${encodeURIComponent(slug)}/config`);
}

export function getStoreProducts(
  slug: string,
  options: { search?: string; categoryId?: string } = {},
) {
  const query = new URLSearchParams();
  if (options.search) query.set("search", options.search);
  if (options.categoryId) query.set("categoryId", options.categoryId);
  const suffix = query.toString() ? `?${query}` : "";
  return createApiRequest<StoreProduct[]>(
    `${PUBLIC}/${encodeURIComponent(slug)}/products${suffix}`,
  );
}

export function getStoreProduct(slug: string, productId: string) {
  return createApiRequest<StoreProduct>(
    `${PUBLIC}/${encodeURIComponent(slug)}/products/${encodeURIComponent(productId)}`,
  );
}

export function openStoreCart(slug: string, cartToken?: string) {
  return createApiRequest<StoreCart>(`${PUBLIC}/${encodeURIComponent(slug)}/cart`, {
    method: "POST",
    body: JSON.stringify(cartToken ? { cartToken } : {}),
  });
}

export function addToStoreCart(
  slug: string,
  cartToken: string,
  productId: string,
  quantity: number,
  variantId?: string,
) {
  return createApiRequest<StoreCart>(`${PUBLIC}/${encodeURIComponent(slug)}/cart`, {
    method: "POST",
    body: JSON.stringify({ cartToken, productId, quantity, variantId }),
  });
}

export function getStoreCart(slug: string, cartToken: string) {
  return createApiRequest<StoreCart>(
    `${PUBLIC}/${encodeURIComponent(slug)}/cart/${encodeURIComponent(cartToken)}`,
  );
}

export function checkoutStoreCart(
  slug: string,
  body: {
    cartToken: string;
    customerName?: string;
    customerPhone?: string;
    deliveryAddress?: string;
    paymentMethod?: "cash" | "bank_transfer" | "card";
  },
) {
  return createApiRequest<{ orderId: string; status: string; totalMinor: number }>(
    `${PUBLIC}/${encodeURIComponent(slug)}/checkout`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

/**
 * Asks the API which shop owns the hostname the browser is currently on. This is
 * what lets `shop.example.com` serve its own storefront with no edge rewrite.
 *
 * The API is usually a different origin, so the browser would send the API's own
 * Host header. The shopper's hostname is forwarded explicitly instead.
 */
