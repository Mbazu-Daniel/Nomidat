import type { CSSProperties } from "react";
import type { StorefrontConfig } from "@/data/storefront";

/**
 * The shop's own colours, applied as CSS custom properties. The API has already
 * narrowed the theme to known colour tokens, so nothing untrusted reaches the
 * style attribute.
 *
 * A token the seller never set stays `undefined`, which React drops from the
 * style attribute — that is what lets the `--shop-*` fallbacks declared in
 * storefront.css fall back to the app theme.
 */
export function storefrontThemeStyle(theme: StorefrontConfig["theme"]): CSSProperties {
  return {
    "--shop-accent": theme.accent,
    "--shop-background": theme.background,
    "--shop-surface": theme.surface,
    "--shop-text": theme.text,
    "--shop-muted": theme.muted,
  } as CSSProperties;
}
