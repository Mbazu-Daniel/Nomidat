import type { TransactionLineItemProps } from "./types/picture.type";

export function TransactionLineItem({
  item,
  index,
  products,
  fromPicture,
  updateItem,
  canRemove,
  onRemove,
}: TransactionLineItemProps) {
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
                    unitPriceKobo: fromPicture ? item.unitPriceKobo : (product.priceKobo ?? 0),
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
        Unit price (₦)
        <input
          type="number"
          min="0"
          max="20000000"
          step="0.01"
          required
          value={item.unitPriceKobo === null ? "" : item.unitPriceKobo / 100}
          onChange={(event) =>
            updateItem(item.key, {
              unitPriceKobo:
                event.target.value === "" ? null : Math.round(Number(event.target.value) * 100),
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
