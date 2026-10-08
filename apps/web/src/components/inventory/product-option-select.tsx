import type { Product } from "@/data/catalog";
import { useProductVariants } from "./use-product-variants";

/**
 * A product and, when that product has options, which one. Both are asked
 * together because a serial or a batch belongs to a specific option — a colour
 * variant of a phone is a different unit with a different code.
 */
export function ProductOptionSelect({
  organizationId,
  products,
  productId,
  variantId,
  onProductChange,
  onVariantChange,
  productLabel = "Product",
}: {
  organizationId: string;
  products: Product[];
  productId: string;
  variantId: string;
  onProductChange: (value: string) => void;
  onVariantChange: (value: string) => void;
  productLabel?: string;
}) {
  const { byProduct, error } = useProductVariants(organizationId, [productId]);
  const variants = byProduct[productId] ?? [];
  const product = products.find((item) => item.id === productId);

  return (
    <>
      <div>
        <label htmlFor="tracked-product">{productLabel}</label>
        <select
          id="tracked-product"
          value={productId}
          onChange={(event) => onProductChange(event.target.value)}
          required
        >
          <option value="">Choose a product…</option>
          {products
            .filter((item) => item.isActive)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
      </div>

      {variants.length > 0 && (
        <div>
          <label htmlFor="tracked-variant">Option</label>
          <select
            id="tracked-variant"
            value={variantId}
            onChange={(event) => onVariantChange(event.target.value)}
          >
            <option value="">Choose an option…</option>
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="workspace-error">{error}</p>}
      {product && <span className="inventory-hint">{product.unit}</span>}
    </>
  );
}
