import { getProducts, type Product } from "@/data/catalog";
import { useAsyncResource } from "@/lib/use-api-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProductVariants } from "./use-product-variants";

/**
 * A line as the form holds it. Every field is a string because an empty or
 * half-typed quantity is not a number yet, and coercing it on each keystroke
 * would fight the seller mid-entry. `unitCost` is in major units as typed and
 * becomes minor units on submit, using the business's own currency scale.
 */
export interface StockLineDraft {
  productId: string;
  variantId: string;
  quantity: string;
  unitCost: string;
}

export function emptyLine(): StockLineDraft {
  return { productId: "", variantId: "", quantity: "", unitCost: "" };
}

export interface ParsedStockLine {
  productId: string;
  variantId: string;
  quantity: number;
}

/**
 * A line the API will accept, or null when it is not ready. Quantities are
 * strictly positive: a transfer or a return of nothing is not a line.
 */
export function parseStockLine(line: StockLineDraft): ParsedStockLine | null {
  const quantity = Number(line.quantity);
  if (!line.productId || !Number.isFinite(quantity) || quantity <= 0) return null;
  return { productId: line.productId, variantId: line.variantId, quantity };
}

/**
 * A counted line. Zero is a real answer here — "the shelf is empty" is exactly
 * what a count is for — so this admits it where `parseStockLine` does not.
 */
export function parseCountedLine(line: StockLineDraft): ParsedStockLine | null {
  const quantity = Number(line.quantity);
  if (
    !line.productId ||
    line.quantity.trim() === "" ||
    !Number.isFinite(quantity) ||
    quantity < 0
  ) {
    return null;
  }
  return { productId: line.productId, variantId: line.variantId, quantity };
}

/**
 * The product, variant and quantity rows that every stock operation is built
 * from. A transfer, a count, a return and a purchase order differ in what they
 * ask for around the lines, never in the lines themselves, so they share this.
 */
export function StockLineEditor({
  organizationId,
  lines,
  onChange,
  showCost = false,
  quantityLabel = "Quantity",
}: {
  organizationId: string;
  lines: StockLineDraft[];
  onChange: (lines: StockLineDraft[]) => void;
  showCost?: boolean;
  quantityLabel?: string;
}) {
  const products = useAsyncResource<Product[]>(getProducts, organizationId, [], 0);
  const { byProduct, error: variantsError } = useProductVariants(
    organizationId,
    lines.map((line) => line.productId),
  );

  function patch(index: number, change: Partial<StockLineDraft>) {
    onChange(lines.map((line, at) => (at === index ? { ...line, ...change } : line)));
  }

  return (
    <div className="inventory-lines">
      {variantsError && <p className="workspace-error">{variantsError}</p>}
      {products.error && <p className="workspace-error">{products.error}</p>}

      {lines.map((line, index) => {
        const product = products.data.find((item) => item.id === line.productId);
        const variants = byProduct[line.productId] ?? [];
        return (
          <div className="inventory-line" key={index}>
            <select
              aria-label="Product"
              value={line.productId}
              onChange={(event) => patch(index, { productId: event.target.value, variantId: "" })}
            >
              <option value="">Choose a product…</option>
              {products.data
                .filter((item) => item.isActive)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>

            <select
              aria-label="Option"
              value={line.variantId}
              disabled={variants.length === 0}
              onChange={(event) => patch(index, { variantId: event.target.value })}
            >
              <option value="">{variants.length === 0 ? "No options" : "Choose an option…"}</option>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.name}
                </option>
              ))}
            </select>

            <label className="inventory-line-amount">
              <span>{quantityLabel}</span>
              <Input
                type="number"
                min="0"
                step="0.001"
                inputMode="decimal"
                value={line.quantity}
                onChange={(event) => patch(index, { quantity: event.target.value })}
              />
            </label>

            {showCost && (
              <label className="inventory-line-amount">
                <span>Unit cost</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={line.unitCost}
                  onChange={(event) => patch(index, { unitCost: event.target.value })}
                />
              </label>
            )}

            <span className="inventory-line-unit">{product?.unit ?? ""}</span>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Remove line"
              onClick={() => onChange(lines.filter((_, at) => at !== index))}
            >
              Remove
            </Button>
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...lines, emptyLine()])}
      >
        Add line
      </Button>
    </div>
  );
}
