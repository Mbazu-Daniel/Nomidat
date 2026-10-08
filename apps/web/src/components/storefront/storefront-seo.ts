import type { StorefrontConfig } from "@/data/storefront";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Turns the seller's SEO block into document head tags.
 *
 * Every value falls back to the shop's own name, because a shop with no SEO
 * configured still needs a title — and a title is what a search result shows.
 */
export function storefrontMeta(config: StorefrontConfig | undefined) {
  const seo = config?.seo ?? {};
  const name = config?.name ?? "Shop";
  const title = text(seo.title) || name;
  const description = text(seo.description) || `Browse what ${name} has in stock.`;
  const keywords = text(seo.keywords);
  const image = text(seo.ogImage);

  return {
    meta: [
      { title },
      { name: "description", content: description },
      ...(keywords ? [{ name: "keywords", content: keywords }] : []),
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      ...(image
        ? [
            { property: "og:image", content: image },
            { name: "twitter:card", content: "summary_large_image" },
          ]
        : []),
    ],
  };
}
