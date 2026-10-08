import {
  getCategories,
  getProductCategories,
  setProductCategories,
  type ProductCategory,
} from "@/data/catalog";
import { useAsyncResource } from "@/lib/use-api-resource";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Which categories a product sits in. A product can be in several at once, so
 * this replaces the whole set on save — the current one is read first so nothing
 * is silently dropped.
 */
export function ProductCategories({
  organizationId,
  productId,
}: {
  organizationId: string;
  productId: string;
}) {
  const [revision, setRevision] = useState(0);
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const all = useAsyncResource<ProductCategory[]>(getCategories, organizationId, [], revision);
  const load = useCallback(
    () => getProductCategories(organizationId, productId),
    [organizationId, productId],
  );
  const assigned = useAsyncResource<ProductCategory[]>(load, productId, [], revision);

  // Seeded once, after the read lands. Seeding during the first render would
  // start from the empty placeholder and leave the boxes blank once the real
  // assignment arrived.
  const seeded = useRef(false);
  useEffect(() => {
    if (assigned.loading || seeded.current) return;
    seeded.current = true;
    setChosen(assigned.data.map((row) => row.id));
  }, [assigned.loading, assigned.data]);

  async function save() {
    setBusy(true);
    try {
      await setProductCategories(organizationId, productId, chosen);
      setRevision((n) => n + 1);
      toast.success("Categories saved.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not save categories");
    } finally {
      setBusy(false);
    }
  }

  if (all.error) return null;

  return (
    <section className="workspace-form">
      <h3>Categories</h3>
      <p className="workspace-readonly">
        Where this product appears in your shop. Pick as many as apply.
      </p>

      <div className="workspace-category-picker">
        {all.data.map((category) => (
          <label key={category.id}>
            <input
              type="checkbox"
              checked={chosen.includes(category.id)}
              onChange={(event) =>
                setChosen((current) => {
                  const set = new Set(current);
                  if (event.target.checked) set.add(category.id);
                  else set.delete(category.id);
                  return [...set];
                })
              }
            />
            {category.name}
          </label>
        ))}
      </div>

      {!all.data.length && <p className="inventory-empty">No categories yet.</p>}
      {assigned.error && <p className="workspace-error">{assigned.error}</p>}

      <button
        className="workspace-primary"
        disabled={busy || assigned.loading}
        onClick={() => void save()}
      >
        {busy ? "Saving…" : "Save categories"}
      </button>
    </section>
  );
}
