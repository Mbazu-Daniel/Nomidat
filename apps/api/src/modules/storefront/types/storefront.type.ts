/** Lifecycle of a shopper's basket. A converted basket has become an order. */
export const CartStatus = {
  OPEN: "open",
  CONVERTED: "converted",
  ABANDONED: "abandoned",
} as const;
type CartStatus = (typeof CartStatus)[keyof typeof CartStatus];

/** How a storefront hostname was attached to a shop. */
export const StorefrontDomainKind = {
  SUBDOMAIN: "subdomain",
  CUSTOM: "custom",
} as const;
export type StorefrontDomainKind = (typeof StorefrontDomainKind)[keyof typeof StorefrontDomainKind];

/** Which payment methods a storefront offers at checkout. */
const StorefrontPaymentMethod = {
  CASH: "cash",
  BANK_TRANSFER: "bank_transfer",
  CARD: "card",
} as const;
export type StorefrontPaymentMethod =
  (typeof StorefrontPaymentMethod)[keyof typeof StorefrontPaymentMethod];

export const STOREFRONT_PAYMENT_METHODS = Object.values(StorefrontPaymentMethod);

/**
 * A shop's theme. Only these tokens may be set, and only to colour values, so a
 * seller cannot smuggle arbitrary CSS into a public page through the theme.
 */
const STOREFRONT_THEME_TOKENS = [
  "accent",
  "background",
  "surface",
  "text",
  "muted",
] as const;
export type StorefrontThemeToken = (typeof STOREFRONT_THEME_TOKENS)[number];

export type StorefrontTheme = Partial<Record<StorefrontThemeToken, string>>;

/** A colour value, and nothing else. Rejects url(), expressions and stray CSS. */
const COLOR_VALUE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|[a-z]{3,20})$/i;

/**
 * Narrows a seller-supplied theme to known tokens with colour values, dropping
 * anything else. Fails closed: an unrecognised key never reaches the page.
 */
export function sanitizeStorefrontTheme(theme: unknown): StorefrontTheme {
  if (typeof theme !== "object" || theme === null) return {};

  const entries = Object.entries(theme).filter(
    (entry): entry is [string, unknown] =>
      (STOREFRONT_THEME_TOKENS as readonly string[]).includes(entry[0]) &&
      typeof entry[1] === "string" &&
      COLOR_VALUE.test(entry[1].trim()),
  );

  return Object.fromEntries(entries) as StorefrontTheme;
}

/** The public shape of a shop, safe to hand to an unauthenticated browser. */
interface StorefrontConfig {
  organizationId: string;
  slug: string;
  name: string;
  /** ISO 4217 code; a shop is not assumed to trade in one country. */
  currency: string;
  template: string;
  theme: StorefrontTheme;
  seo: Record<string, unknown>;
  checkout: Record<string, unknown>;
  pages: Record<string, unknown>;
  /** Already sanitised by the API; never the raw stored text. */
  customCss: string;
}

export interface ResolvedStore {
  organizationId: string;
  slug: string;
  hostname: string;
  template: string;
  published: boolean;
}
