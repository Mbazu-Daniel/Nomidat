import type { TransactionLineItemProps } from "./types/picture.type";
import { minorToDecimalInput, parseMoneyToMinor } from "@/lib/money";
import { useCurrency } from "@/lib/currency-context";

export function TransactionLineItem({
  item,
  index,
  products,
  fromPicture,
  updateItem,
  canRemove,
  onRemove,
}: TransactionLineItemProps) {
  // The business's own currency, so the price the seller types in is the price
  // the record stores — a fixed hundredth would misread it in any currency
  // without hundredths.
  const currency = useCurrency();
  return (
    <div className="workspace-line-item" key={item.key}>
      <label>
        Product
        <select
          value={item.productId}
          onChange={(event) => {
            const product = products.find((row) => row.id === event.target.value);
            updateItem(item.key, {
              productId: event.target.value,
              ...(product
                ? {
                    description: product.name ?? "",
                    unitPriceMinor: fromPicture ? item.unitPriceMinor : (product.priceMinor ?? 0),
                  }
                : {}),
            });
          }}
        >
          <option value="">Custom item</option>
          {products
            .filter((product) => product.isActive !== false)
            .map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.stockQuantity} available)
              </option>
            ))}
        </select>
      </label>
      <label>
        Description
        <input
          aria-label={`Item ${index + 1} description`}
          value={item.description}
          required
          maxLength={300}
          onChange={(event) => updateItem(item.key, { description: event.target.value })}
        />
      </label>
      <label>
        Qty
        <input
          type="number"
          min="1"
          max="100000"
          step="1"
          required
          value={item.quantity ?? ""}
          onChange={(event) =>
            updateItem(item.key, {
              quantity: event.target.value === "" ? null : Number(event.target.value),
            })
          }
        />
      </label>
      <label>
        Unit price ({currency})
        <input
          type="number"
          min="0"
          max="20000000"
          step={Number(minorToDecimalInput(1, currency))}
          required
          value={
            item.unitPriceMinor === null ? "" : minorToDecimalInput(item.unitPriceMinor, currency)
          }
          onChange={(event) =>
            updateItem(item.key, {
              unitPriceMinor:
                event.target.value === "" ? null : parseMoneyToMinor(event.target.value, currency),
            })
          }
        />
      </label>
      <button
        type="button"
        aria-label={`Remove item ${index + 1}`}
        disabled={!canRemove}
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}
