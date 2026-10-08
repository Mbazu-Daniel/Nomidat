/**
 * Properties that can move data out of the page or execute code. Seller CSS is
 * rendered on a public page, so these are stripped rather than trusted.
 */
const FORBIDDEN_PROPERTIES = new Set([
  "behavior",
  "-moz-binding",
  "content",
  "binding",
  "filter",
  "expression",
  "-ms-filter",
]);

/** `url()` may point anywhere, including an attacker's server. */
const URL_TOKEN = /url\s*\(/i;
const IMPORT_AT_RULE = /@import/i;
const EXPRESSION = /expression\s*\(/i;
const HTML_ANGLE = /[<>]/;

/**
 * Makes seller-authored CSS safe to inject into a public page.
 *
 * A blocklist alone is not enough here: CSS can steal a page's content with
 * `url(https://attacker/…)` or smuggle markup through an unclosed string. This
 * strips the dangerous constructs, then drops the whole sheet if anything
 * suspicious survives, so a bypass fails closed rather than rendering.
 */
export function sanitizeStorefrontCss(css: string | null | undefined): string {
  if (!css) return "";
  if (css.length > 50_000) return "";

  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  // An unterminated string or comment can swallow the rest of the stylesheet.
  if ((withoutComments.match(/"/g) ?? []).length % 2 !== 0) return "";
  if ((withoutComments.match(/'/g) ?? []).length % 2 !== 0) return "";

  if (URL_TOKEN.test(withoutComments)) return "";
  if (IMPORT_AT_RULE.test(withoutComments)) return "";
  if (EXPRESSION.test(withoutComments)) return "";
  if (HTML_ANGLE.test(withoutComments)) return "";
  if (/javascript:/i.test(withoutComments)) return "";

  const cleaned = withoutComments
    .split(";")
    .map((declaration) => declaration.trim())
    .filter((declaration) => {
      if (!declaration || declaration.startsWith("@")) return false;
      const property = declaration.split(":")[0]?.trim().toLowerCase() ?? "";
      return property.length > 0 && !FORBIDDEN_PROPERTIES.has(property);
    })
    .join(";");

  return cleaned;
}
