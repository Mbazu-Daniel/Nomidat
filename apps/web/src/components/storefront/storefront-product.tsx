import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import type { StoreProduct } from "@/data/storefront";
import { getStorefrontConfig, getStoreProduct } from "@/data/storefront";
import { formatMoney } from "@/lib/money";
import { useAsyncResource } from "@/lib/use-api-resource";
import { addProductToCart } from "@/lib/storefront-cart";
import { Button } from "@/components/ui/button";
// EMPTY_STOREFRONT_CONFIG lives with the type it satisfies, not with the theme
// helper that consumes it.
import { EMPTY_STOREFRONT_CONFIG } from "@/data/storefront";
import { storefrontThemeStyle } from "./storefront-theme";
import "./storefront.css";

const EMPTY_PRODUCT = {
  id: "",
  name: "",
  description: null,
  priceMinor: 0,
  sku: null,
  unit: "",
  inStock: false,
  variants: [],
} as StoreProduct;

/** One product, with a working add-to-basket. */
export function StorefrontProduct({ slug, productId }: { slug: string; productId: string }) {
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);

  const config = useAsyncResource(getStorefrontConfig, slug, EMPTY_STOREFRONT_CONFIG, revision);
  const product = useAsyncResource(
    (key: string) => getStoreProduct(slug, key),
    productId,
    EMPTY_PRODUCT,
    revision,
  );

  const options = product.data.variants ?? [];
  const selected = options.find((option) => option.id === chosen) ?? null;
  // A product with options cannot be added until one is picked: the basket line
  // must name the variant, or the stock movement would draw down the wrong row.
  const needsChoice = options.length > 0 && selected === null;
  const sellable = selected ? selected.inStock : product.data.inStock;

  /**
   * Adds the product itself, not a step towards a checkout that then has an empty
   * basket. The button previously linked to checkout without adding anything, so
   * the shopper arrived to nothing.
   */
  async function add() {
    if (needsChoice) return;
    setBusy(true);
    try {
      const cart = await addProductToCart(slug, productId, 1, selected?.id);
      setAdded(cart.itemCount);
      toast.success(`${product.data.name} added to your basket`);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not add to basket.");
    } finally {
      setBusy(false);
    }
  }

  if (product.error) {
    return (
      <main className="storefront">
        <h1>Product unavailable</h1>
        <p>{product.error}</p>
        <Link to="/store/$orgSlug" params={{ orgSlug: slug }}>
          Back to the shop
        </Link>
      </main>
    );
  }

  return (
    <main
      className={`storefront storefront-${config.data.template}`}
      style={storefrontThemeStyle(config.data.theme)}
    >
      <Link to="/store/$orgSlug" params={{ orgSlug: slug }} className="storefront-back">
        ← {config.data.name}
      </Link>

      <article className="storefront-detail">
        <h1>{product.data.name}</h1>
        <p className="storefront-price">
          {formatMoney(selected?.priceMinor ?? product.data.priceMinor, config.data.currency)}
        </p>
        {product.data.description && <p className="storefront-note">{product.data.description}</p>}

        {options.length > 0 && (
          <fieldset className="storefront-options">
            <legend>Choose an option</legend>
            <div className="storefront-option-list">
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={option.id === chosen}
                  disabled={!option.inStock}
                  onClick={() => setChosen(option.id)}
                  className="storefront-option"
                >
                  {option.name}
                  {!option.inStock && <span> · sold out</span>}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <dl className="storefront-facts">
          {product.data.sku && (
            <div>
              <dt>SKU</dt>
              <dd>{product.data.sku}</dd>
            </div>
          )}
          <div>
            <dt>Sold by</dt>
            <dd>{product.data.unit}</dd>
          </div>
          <div>
            <dt>Availability</dt>
            <dd>{sellable ? "In stock" : "Sold out"}</dd>
          </div>
        </dl>

        <div className="storefront-detail-actions">
          <Button type="button" onClick={add} disabled={busy || needsChoice || !sellable}>
            {needsChoice
              ? "Choose an option"
              : sellable
                ? busy
                  ? "Adding…"
                  : "Add to basket"
                : "Sold out"}
          </Button>
          {added > 0 && (
            <Link
              to="/store/$orgSlug/checkout"
              params={{ orgSlug: slug }}
              className="storefront-buy"
            >
              Go to basket ({added})
            </Link>
          )}
          <Button type="button" variant="outline" onClick={() => setRevision((n) => n + 1)}>
            Refresh
          </Button>
        </div>
      </article>
    </main>
  );
}
