import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { StoreProduct, StorefrontConfig } from "@/data/storefront";
import { getStoreProducts } from "@/data/storefront";
import { formatMoney } from "@/lib/money";
import { useAsyncResource } from "@/lib/use-api-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { storefrontThemeStyle } from "./storefront-theme";
import "./storefront.css";

/**
 * The cheapest variant price, or null when the product has no options. A card
 * has to show one number; leading with the lowest option is the only one that
 * is true of every option.
 */
function lowestVariant(product: StoreProduct): number | null {
  const prices = (product.variants ?? []).map((variant) => variant.priceMinor);
  return prices.length ? Math.min(...prices) : null;
}

/** The shop front: everything a shopper can see, and nothing a seller cannot. */
export function StorefrontHome({
  slug,
  config: loaded,
}: {
  slug: string;
  config?: StorefrontConfig;
}) {
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);

  const products = useAsyncResource(
    (key: string) => getStoreProducts(slug, { search: key || undefined }),
    search ? `${search}|${revision}` : `|${revision}`,
    [],
  );

  // The route loader already fetched this for the document head, so it is passed
  // in rather than requested a second time. Absent means the shop is not
  // published, which the API reports the same way as a shop that never existed.
  if (!loaded) {
    return (
      <main className="storefront">
        <h1>Shop unavailable</h1>
        <p>This shop is not published, or the address is wrong.</p>
      </main>
    );
  }
  const config = { data: loaded, error: "", loading: false };

  return (
    <main
      className={`storefront storefront-${config.data.template}`}
      style={storefrontThemeStyle(config.data.theme)}
    >
      <header className="storefront-header">
        <h1>{config.data.name}</h1>
        <p>Browse what we have in stock.</p>
      </header>

      <form
        className="storefront-search"
        onSubmit={(event) => {
          event.preventDefault();
          setRevision((n) => n + 1);
        }}
      >
        <Input
          type="search"
          aria-label="Search products"
          placeholder="Search products"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button type="submit">Search</Button>
      </form>

      <ul className="storefront-grid">
        {products.data.map((product) => {
          const from = lowestVariant(product);
          return (
            <li key={product.id} className="storefront-card">
              <Link
                to="/store/$orgSlug/products/$productId"
                params={{ orgSlug: slug, productId: product.id }}
              >
                <h2>{product.name}</h2>
                <p className="storefront-price">
                  {/* A product with options has no single price. Showing the parent
                  rate would advertise one and charge another, so lead with the
                  cheapest option and say it starts there. */}
                  {from === null
                    ? formatMoney(product.priceMinor, config.data.currency)
                    : `From ${formatMoney(from, config.data.currency)}`}
                </p>
                {from !== null && (
                  <p className="storefront-note">
                    {product.variants.length} option{product.variants.length === 1 ? "" : "s"}
                  </p>
                )}
                {product.description && <p className="storefront-note">{product.description}</p>}
                <span className={`storefront-stock ${product.inStock ? "" : "out"}`}>
                  {product.inStock ? "In stock" : "Sold out"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {!products.loading && !products.data.length && (
        <p className="storefront-note">Nothing here yet.</p>
      )}
    </main>
  );
}
