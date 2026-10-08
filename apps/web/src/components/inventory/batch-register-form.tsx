import { getProducts, type Product } from "@/data/catalog";
import { registerBatch } from "@/data/serials";
import { useAsyncResource } from "@/lib/use-api-resource";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ProductOptionSelect } from "./product-option-select";
import { useWarehouses } from "./use-warehouses";

export function BatchRegisterForm({
  organizationId,
  onCreated,
}: {
  organizationId: string;
  onCreated: () => void;
}) {
  const products = useAsyncResource<Product[]>(getProducts, organizationId, [], 0);
  const warehouses = useWarehouses(organizationId);
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [code, setCode] = useState("");
  const [quantity, setQuantity] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const count = Number(quantity);
  const ready = productId !== "" && code.trim() !== "" && Number.isFinite(count) && count > 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await registerBatch(organizationId, {
        productId,
        variantId: variantId || undefined,
        code: code.trim(),
        quantity: count,
        warehouseId: warehouseId || undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });
      setCode("");
      setQuantity("");
      setExpiresAt("");
      onCreated();
      toast.success("Batch registered and booked in.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not register that batch.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="inventory-create-form inventory-operation-form" onSubmit={submit}>
      <ProductOptionSelect
        organizationId={organizationId}
        products={products.data}
        productId={productId}
        variantId={variantId}
        onProductChange={(value) => {
          setProductId(value);
          setVariantId("");
        }}
        onVariantChange={setVariantId}
      />
      <div>
        <label htmlFor="batch-code">Lot code</label>
        <input
          id="batch-code"
          value={code}
          maxLength={80}
          onChange={(event) => setCode(event.target.value)}
          placeholder="LOT-2026-04"
          required
        />
      </div>
      <div>
        <label htmlFor="batch-quantity">Quantity</label>
        <input
          id="batch-quantity"
          type="number"
          min="0"
          step="0.001"
          inputMode="decimal"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="batch-warehouse">Into</label>
        <select
          id="batch-warehouse"
          value={warehouseId}
          onChange={(event) => setWarehouseId(event.target.value)}
        >
          <option value="">Default warehouse</option>
          {warehouses.data.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="batch-expiry">Expires</label>
        <input
          id="batch-expiry"
          type="date"
          value={expiresAt}
          onChange={(event) => setExpiresAt(event.target.value)}
        />
      </div>

      {error && <p className="workspace-error">{error}</p>}

      <Button type="submit" disabled={busy || !ready}>
        {busy ? "Registering…" : "Register batch"}
      </Button>
    </form>
  );
}
