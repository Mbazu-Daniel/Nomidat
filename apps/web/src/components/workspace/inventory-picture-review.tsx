import { useEffect, useState } from "react";
import { createApiRequest } from "@/lib/api";
import { RecordForm } from "./record-form";
import type { BusinessRecord } from "./types";
import type { InventoryPictureProps } from "./types/picture.type";

export function InventoryPictureReview(props: InventoryPictureProps) {
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState(0);
  const [productId, setProductId] = useState("");
  const [products, setProducts] = useState<BusinessRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const item = props.items[index];
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    async function load() {
      const all: BusinessRecord[] = [];
      for (let offset = 0; ; offset += 50) {
        const page = await createApiRequest<BusinessRecord[]>(
          `/organizations/${props.organizationId}/products?limit=50&offset=${offset}`,
        );
        if (cancelled) return;
        all.push(...page);
        if (page.length < 50) break;
      }
      setProducts(all.filter((product) => product.isActive !== false));
    }
    void load()
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [props.organizationId, saved]);
  function next(recorded: boolean) {
    if (recorded) setSaved((count) => count + 1);
    if (index === props.items.length - 1) {
      props.onSaved();
      return;
    }
    setIndex((value) => value + 1);
    setProductId("");
    setError("");
  }
  return (
    <div className="picture-inventory-review">
      <div className="picture-review-heading">
        <div>
          <h3>
            Item {index + 1} of {props.items.length}: {item.name ?? "Unnamed product"}
          </h3>
          <p>{saved} saved · Review and save each item separately.</p>
        </div>
        <button className="workspace-secondary" disabled={busy} onClick={() => next(false)}>
          Skip item
        </button>
      </div>
      <label className="picture-product-choice">
        Record as
        <select
          value={productId}
          disabled={busy || loading}
          onChange={(event) => setProductId(event.target.value)}
        >
          <option value="">New product</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              Add stock to {product.name}
            </option>
          ))}
        </select>
      </label>
      {loading && <p role="status">Loading existing products…</p>}
      {error && (
        <p role="alert" className="workspace-error">
          {error}
        </p>
      )}
      {!loading && !productId && (
        <RecordForm
          key={index}
          {...props}
          pictureItems={[item]}
          onSavingChange={setBusy}
          onSaved={() => next(true)}
          onCancel={props.onSaved}
        />
      )}
      {productId && (
        <form
          key={`${index}-${productId}`}
          className="workspace-form workspace-card"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setBusy(true);
            setError("");
            try {
              await createApiRequest(
                `/organizations/${props.organizationId}/products/${productId}/stock-adjustments`,
                {
                  method: "POST",
                  body: JSON.stringify({
                    quantity: Number(data.get("quantity")),
                    reason: "Stock added from reviewed picture",
                  }),
                },
              );
              next(true);
            } catch (reason) {
              setError((reason as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>Add stock</h2>
          <p>
            This quantity is added to the product’s current stock. Its selling price stays the same.
          </p>
          <label>
            Quantity to add
            <input
              name="quantity"
              type="number"
              min="1"
              max="100000"
              step="1"
              defaultValue={item.quantity ?? ""}
              required
              disabled={busy}
            />
          </label>
          <div className="workspace-actions">
            <button
              type="button"
              className="workspace-secondary"
              onClick={props.onSaved}
              disabled={busy}
            >
              Finish
            </button>
            <button className="workspace-primary" disabled={busy}>
              {busy ? "Saving…" : "Save stock addition"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
