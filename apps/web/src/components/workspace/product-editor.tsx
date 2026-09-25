import type { ProductEditorProps } from "./types";

export function ProductEditor({ record, busy, save }: ProductEditorProps) {
  const resource = `/products/${record.id}`;
  return (
    <>
      <form
        className="workspace-form"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void save(
            resource,
            {
              name: data.get("name"),
              sku: data.get("sku"),
              description: data.get("description"),
              costKobo: Math.round(Number(data.get("cost")) * 100),
              unit: data.get("unit"),
              priceKobo: Math.round(Number(data.get("price")) * 100),
              lowStockThreshold: Number(data.get("threshold")),
            },
            "PATCH",
          );
        }}
      >
        <div className="workspace-form-grid">
          <label>
            Product name
            <input name="name" defaultValue={record.name} required maxLength={160} />
          </label>
          <label>
            SKU <input name="sku" defaultValue={record.sku ?? ""} maxLength={80} />
          </label>
          <label>
            Description{" "}
            <input name="description" defaultValue={record.description ?? ""} maxLength={4000} />
          </label>
          <label>
            Cost price (₦)
            <input
              name="cost"
              type="number"
              min="0"
              max="20000000"
              step="0.01"
              defaultValue={(record.costKobo ?? 0) / 100}
              required
            />
          </label>
          <label>
            Unit
            <input name="unit" defaultValue={record.unit} required maxLength={40} />
          </label>
          <label>
            Unit price (₦)
            <input
              name="price"
              type="number"
              min="0"
              max="21474836.47"
              step="0.01"
              defaultValue={(record.priceKobo ?? 0) / 100}
              required
            />
          </label>
          <label>
            Low-stock alert
            <input
              name="threshold"
              type="number"
              min="0"
              step="1"
              defaultValue={record.lowStockThreshold}
              required
            />
          </label>
        </div>
        <div className="workspace-actions">
          <button className="workspace-primary" disabled={busy}>
            Save product
          </button>
          <button
            className="workspace-secondary"
            type="button"
            disabled={busy}
            onClick={() => void save(resource, { isActive: record.isActive === false }, "PATCH")}
          >
            {record.isActive === false ? "Restore product" : "Archive product"}
          </button>
        </div>
        {record.isActive === false && (
          <p>Archived · Restore this product to select it for new sales.</p>
        )}
      </form>
      <form
        className="workspace-form"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void save(`${resource}/stock-adjustments`, {
            quantity: Number(data.get("delta")),
            reason: data.get("reason"),
          });
        }}
      >
        <div className="workspace-form-grid">
          <label>
            Stock adjustment
            <input name="delta" type="number" step="1" required placeholder="10 or -2" />
            <small>Positive adds stock; negative removes it.</small>
          </label>
          <label>
            Reason
            <input
              name="reason"
              required
              maxLength={300}
              placeholder="e.g. Restocked from supplier"
            />
          </label>
        </div>
        <button className="workspace-primary" disabled={busy}>
          Update stock
        </button>
      </form>
    </>
  );
}
