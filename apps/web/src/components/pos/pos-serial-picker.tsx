import { getAvailableSerials, type SerialNumberRow } from "@/data/serials";
import type { PosCatalogProduct } from "@/data/pos";
import { useState } from "react";
import { useLoadedResource } from "@/lib/use-api-resource";
import { Button } from "@/components/ui/button";
import { addCartItem } from "./pos-cart-state";
import type { PosCartItem } from "./types/pos.type";

/**
 * Choosing which physical units are being sold.
 *
 * A serial is one item, so the till cannot add "two phones" — it has to name
 * two serials. Doing it here rather than at checkout means the cashier reads
 * each code back before taking the money.
 */
export function PosSerialPicker({
  organizationId,
  product,
  cart,
  onAdd,
  onClose,
}: {
  organizationId: string;
  product: PosCatalogProduct;
  cart: PosCartItem[];
  onAdd: (items: PosCartItem[]) => void;
  onClose: () => void;
}) {
  const loaded = useLoadedResource(
    () => getAvailableSerials(organizationId, product.id),
    [organizationId, product.id],
    null,
  );
  const serials = loaded.data;
  const error = loaded.error;
  const [chosen, setChosen] = useState<SerialNumberRow[]>([]);

  function add() {
    // Each serial becomes its own line. Two phones of one product can never
    // collapse into a quantity of two that names neither of them.
    const next = chosen.reduce(
      (items, serial) =>
        addCartItem(items, {
          productId: product.id,
          variantId: product.variantId,
          name: product.name,
          sku: product.sku,
          unitPriceMinor: product.priceMinor,
          quantity: 1,
          serialNumberId: serial.id,
          serialCode: serial.code,
          note: "",
        }),
      cart,
    );
    onAdd(next);
    onClose();
  }

  return (
    <div
      className="pos-serial-picker"
      role="dialog"
      aria-label={`Choose a unit of ${product.name}`}
    >
      <h3>{product.name}</h3>
      <p className="pos-serial-hint">
        Each unit is tracked separately. Tick every serial you are selling.
      </p>

      {error && <p className="workspace-error">{error}</p>}
      {!serials && !error && <p role="status">Loading units…</p>}

      {serials && !serials.length && (
        <p className="workspace-error">
          No units in stock. Register a serial before selling this product.
        </p>
      )}

      {!!serials?.length && (
        <ul className="pos-serial-list">
          {serials.map((serial) => (
            <li key={serial.id}>
              <label>
                <input
                  type="checkbox"
                  checked={chosen.some((item) => item.id === serial.id)}
                  onChange={() =>
                    setChosen((current) =>
                      current.some((item) => item.id === serial.id)
                        ? current.filter((item) => item.id !== serial.id)
                        : [...current, serial],
                    )
                  }
                />
                <span className="pos-serial-code">{serial.code}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="pos-serial-actions">
        <Button type="button" size="sm" disabled={!chosen.length} onClick={add}>
          {chosen.length === 1 ? "Add 1 unit" : `Add ${chosen.length} units`}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
