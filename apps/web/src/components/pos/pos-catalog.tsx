import type { PosCatalogProduct } from "@/data/pos";
import { addCartItem } from "./pos-cart-state";
import { PosSerialPicker } from "./pos-serial-picker";
import type { PosCartItem } from "./types/pos.type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/money";
import { useCurrency } from "@/lib/currency-context";

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
  const [picking, setPicking] = useState<PosCatalogProduct | null>(null);
  // The till prices in the business's own currency, read from context rather
  // than assumed: a shelf label in the wrong currency is a price the seller
  // cannot honour.
  const currency = useCurrency();

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(needle) ||
        (product.sku ?? "").toLowerCase().includes(needle),
    );
  }, [products, query]);

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
      <div className="pos-catalog-grid">
        {visible.map((product) => {
          const soldOut = product.stockQuantity <= 0;
          return (
            <Button
              key={`${product.id}:${product.variantId ?? ""}`}
              type="button"
              variant={soldOut ? "outline" : "secondary"}
              disabled={soldOut}
              className="pos-catalog-tile"
              onClick={() => add(product)}
            >
              <span className="pos-catalog-name">{product.name}</span>
              <span className="pos-catalog-price">{formatMoney(product.priceMinor, currency)}</span>
              <span className="pos-catalog-stock">
                {soldOut ? "Out of stock" : `${product.stockQuantity} ${product.unit} left`}
              </span>
              {product.isSerialized && <span className="pos-catalog-serial">Serialised</span>}
            </Button>
          );
        })}
      </div>
      {!visible.length && <p className="pos-catalog-empty">No products match “{query}”.</p>}

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
