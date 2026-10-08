import {
  createProductVariant,
  getProductVariants,
  updateProductVariant,
  type ProductVariant,
} from "@/data/catalog";
import { useAsyncResource } from "@/lib/use-api-resource";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { minorToDecimalInput, parseMoneyToMinor, formatMoney } from "@/lib/money";
import { useCurrency } from "@/lib/currency-context";

/**
 * The options a product is sold in — a phone in black or gold, a shirt in S or L.
 *
 * A product with options cannot be sold as itself: the till and the storefront
 * both draw down a variant's own Stock Level, so an option that exists only in
 * the database is a line nobody can buy.
 */
export function VariantEditor({
  organizationId,
  productId,
  onSaved,
}: {
  organizationId: string;
  productId: string;
  onSaved: () => void;
}) {
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Stable identity, because the hook refetches whenever the loader changes.
  const load = useCallback(
    () => getProductVariants(organizationId, productId),
    [organizationId, productId],
  );
  const variants = useAsyncResource<ProductVariant[]>(load, productId, [], revision);
  // The options' prices are typed and shown in the business's own currency; a
  // fixed two decimals would misread any currency without hundredths.
  const currency = useCurrency();

  function refresh() {
    setRevision((n) => n + 1);
    onSaved();
  }

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      await action();
      refresh();
      toast.success(message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save that option");
    } finally {
      setBusy(false);
    }
  }

  function createFrom(form: HTMLFormElement) {
    const data = new FormData(form);
    const priceMinor = parseMoneyToMinor(String(data.get("price") ?? ""), currency);
    if (priceMinor === null) {
      setError(`Enter a price such as ${minorToDecimalInput(45_000, currency)}.`);
      return;
    }
    const costRaw = String(data.get("cost") ?? "").trim();
    const costMinor = costRaw ? parseMoneyToMinor(costRaw, currency) : 0;
    if (costMinor === null) {
      setError(`Enter a cost such as ${minorToDecimalInput(30_000, currency)}, or leave it empty.`);
      return;
    }
    void run(
      () =>
        createProductVariant(organizationId, productId, {
          name: String(data.get("name") ?? "").trim(),
          sku: String(data.get("sku") ?? "").trim() || undefined,
          barcode: String(data.get("barcode") ?? "").trim() || undefined,
          priceMinor,
          costMinor,
        }),
      "Option added.",
    );
  }

  return (
    <section className="workspace-form">
      <h3>Options</h3>
      <p className="workspace-readonly">
        Add options when one product comes in more than one form — size, colour, capacity. Each
        option keeps its own price and its own stock.
      </p>

      {variants.error && <p className="workspace-error">{variants.error}</p>}
      {error && <p className="workspace-error">{error}</p>}

      <table className="inventory-plain-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>SKU</th>
            <th>Price ({currency})</th>
            <th>Cost ({currency})</th>
            <th>Active</th>
          </tr>
        </thead>
        <tbody>
          {variants.data.map((variant) => (
            <tr key={variant.id}>
              <td>{variant.name}</td>
              <td>{variant.sku ?? "—"}</td>
              <td className="inventory-numeric">{formatMoney(variant.priceMinor, currency)}</td>
              <td className="inventory-numeric">{formatMoney(variant.costMinor ?? 0, currency)}</td>
              <td>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () =>
                        updateProductVariant(organizationId, productId, variant.id, {
                          isActive: !variant.isActive,
                        }),
                      variant.isActive ? "Option archived." : "Option restored.",
                    )
                  }
                >
                  {variant.isActive ? "Archive" : "Restore"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!variants.loading && !variants.data.length && (
        <p className="inventory-empty">No options. This product sells as itself.</p>
      )}

      <form
        className="workspace-form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          createFrom(event.currentTarget);
        }}
      >
        <label>
          Option name
          <input name="name" required maxLength={255} placeholder="64GB Black" />
        </label>
        <label>
          SKU <input name="sku" maxLength={100} />
        </label>
        <label>
          Barcode <input name="barcode" maxLength={100} />
        </label>
        <label>
          Price ({currency})
          <input
            name="price"
            type="number"
            min="0"
            step={Number(minorToDecimalInput(1, currency))}
            required
            placeholder={minorToDecimalInput(45_000, currency)}
          />
        </label>
        <label>
          Cost ({currency})
          <input
            name="cost"
            type="number"
            min="0"
            step={Number(minorToDecimalInput(1, currency))}
            placeholder={minorToDecimalInput(30_000, currency)}
          />
        </label>
        <button className="workspace-primary" disabled={busy}>
          Add option
        </button>
      </form>
    </section>
  );
}
