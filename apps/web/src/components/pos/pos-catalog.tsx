import type { PosCatalogProduct } from "@/data/pos";
import { addCartItem } from "./pos-cart-state";
import { PosSerialPicker } from "./pos-serial-picker";
import type { PosCartItem } from "./types/pos.type";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/money";
import { useCurrency } from "@/lib/currency-context";

/**
 * The picture, or a neutral placeholder.
 *
 * A product with no photo is ordinary, so the tile still renders — the grid is
 * for selling, and withholding a product because nobody has photographed it yet
 * would hide sellable stock. The fallback is the product's initials rather than
 * a broken-image glyph, so an unphotographed product is still identifiable at a
 * glance across a counter.
 */
function PosCatalogImage({ product }: { product: PosCatalogProduct }) {
  if (!product.imageUrl) {
    return (
      <span className="pos-catalog-image-fallback" aria-hidden="true">
        {product.name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      className="pos-catalog-image"
      src={product.imageUrl}
      alt=""
      loading="lazy"
      decoding="async"
      // A picture is decoration next to the name, which is already on the tile.
      // Empty alt keeps a screen reader from reading the filename aloud.
    />
  );
}

export function PosCatalog({
  organizationId,
  products,
  cart,
  onAdd,
}: {
  organizationId: string;
  products: PosCatalogProduct[];
  cart: PosCartItem[];
  onAdd: (items: PosCartItem[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [picking, setPicking] = useState<PosCatalogProduct | null>(null);
  // The till prices in the business's own currency, read from context rather
  // than assumed: a shelf label in the wrong currency is a price the seller
  // cannot honour.
  const currency = useCurrency();

  // Every category present in the catalog, in the order the API returned them.
  // Derived from the products rather than asked for separately, so a tab can
  // never appear for a category with nothing in it.
  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const product of products) {
      for (const name of product.categoryNames) if (!seen.includes(name)) seen.push(name);
    }
    return seen;
  }, [products]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      if (category && !product.categoryNames.includes(category)) return false;
      if (!needle) return true;
      return (
        product.name.toLowerCase().includes(needle) ||
        (product.sku ?? "").toLowerCase().includes(needle)
      );
    });
  }, [products, query, category]);

  function add(product: PosCatalogProduct) {
    if (product.stockQuantity <= 0) return;
    // A serialised product cannot be added blind: the till has to name the unit.
    if (product.isSerialized) {
      setPicking(product);
      return;
    }
    onAdd(
      addCartItem(cart, {
        productId: product.id,
        variantId: product.variantId,
        name: product.name,
        sku: product.sku,
        unitPriceMinor: product.priceMinor,
        quantity: 1,
        serialNumberId: null,
        serialCode: null,
        note: "",
      }),
    );
  }

  return (
    <section className="pos-catalog" aria-label="Product catalog">
      <Input
        type="search"
        placeholder="Search products or scan a SKU"
        aria-label="Search products"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {categories.length > 0 && (
        <div className="pos-catalog-tabs" role="tablist" aria-label="Product categories">
          {/*
            "All" clears the category filter rather than being a category of its
            own, so a search that finds nothing outside the current tab is
            recoverable without the seller having to know which tab they are on.
          */}
          <button
            type="button"
            role="tab"
            aria-selected={category === null}
            className={`pos-catalog-tab${category === null ? " is-active" : ""}`}
            onClick={() => setCategory(null)}
          >
            All
          </button>
          {categories.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={category === name}
              className={`pos-catalog-tab${category === name ? " is-active" : ""}`}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <div className="pos-catalog-grid">
        {visible.map((product) => {
          const soldOut = product.stockQuantity <= 0;
          return (
            <button
              key={`${product.id}:${product.variantId ?? ""}`}
              type="button"
              className="pos-catalog-tile"
              disabled={soldOut}
              onClick={() => add(product)}
            >
              <PosCatalogImage product={product} />
              <span className="pos-catalog-name">{product.name}</span>
              <span className="pos-catalog-price">{formatMoney(product.priceMinor, currency)}</span>
              <span className="pos-catalog-stock">
                {soldOut ? "Out of stock" : `${product.stockQuantity} ${product.unit} left`}
              </span>
              {product.isSerialized && <span className="pos-catalog-serial">Serialised</span>}
            </button>
          );
        })}
      </div>
      {!visible.length && (
        <p className="pos-catalog-empty">
          {query ? `No products match “${query}”.` : `Nothing in ${category ?? "this category"}.`}
        </p>
      )}

      {picking && (
        <PosSerialPicker
          organizationId={organizationId}
          product={picking}
          cart={cart}
          onAdd={onAdd}
          onClose={() => setPicking(null)}
        />
      )}
    </section>
  );
}
