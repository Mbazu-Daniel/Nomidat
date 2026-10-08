import { getSuppliers } from "@/data/catalog";
import { FALLBACK_MONEY_POLICY, getMoneyPolicy } from "@/data/money";
import { createPurchaseOrder } from "@/data/stock-operations";
import { parseMoneyToMinor } from "@/lib/money";
import { useAsyncResource } from "@/lib/use-api-resource";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  StockLineEditor,
  emptyLine,
  parseCountedLine,
  type StockLineDraft,
} from "./stock-line-editor";
import { useWarehouses } from "./use-warehouses";

export function PurchaseOrderForm({
  organizationId,
  onCreated,
}: {
  organizationId: string;
  onCreated: () => void;
}) {
  const warehouses = useWarehouses(organizationId);
  const suppliers = useAsyncResource(getSuppliers, organizationId, [], 0);
  const currency = useAsyncResource(getMoneyPolicy, organizationId, FALLBACK_MONEY_POLICY, 0);
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [lines, setLines] = useState<StockLineDraft[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [costError, setCostError] = useState("");

  const items = lines.map(parseCountedLine).filter((line) => line !== null);
  const ready = warehouseId !== "" && items.length === lines.length && lines.length > 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const code = currency.data.currency;

    // Cost is the one field a seller can type wrong in a way the browser will
    // not catch, so every line is parsed against the business's own scale and a
    // single bad line stops the whole order rather than silently costing nothing.
    const built = lines.map((line) => {
      const unitCostMinor = parseMoneyToMinor(line.unitCost, code);
      const quantity = Number(line.quantity);
      if (
        unitCostMinor === null ||
        !line.productId ||
        !Number.isFinite(quantity) ||
        quantity <= 0
      ) {
        return null;
      }
      return {
        productId: line.productId,
        variantId: line.variantId || undefined,
        quantityOrdered: quantity,
        unitCostMinor,
      };
    });

    if (built.some((line) => line === null)) {
      setCostError(`Every line needs a product, a quantity and a unit cost in ${code}.`);
      return;
    }
    if (!warehouseId) return;

    setCostError("");
    setBusy(true);
    try {
      await createPurchaseOrder(organizationId, {
        supplierId: supplierId || undefined,
        warehouseId,
        items: built.filter((line) => line !== null),
        expectedAt: expectedAt ? new Date(expectedAt).toISOString() : undefined,
      });
      setLines([emptyLine()]);
      onCreated();
      toast.success("Purchase order created.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not create the order");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="inventory-create-form inventory-operation-form" onSubmit={submit}>
      <div>
        <label htmlFor="po-supplier">Supplier</label>
        <select
          id="po-supplier"
          value={supplierId}
          onChange={(event) => setSupplierId(event.target.value)}
        >
          <option value="">No supplier</option>
          {suppliers.data.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="po-warehouse">Deliver to</label>
        <select
          id="po-warehouse"
          value={warehouseId}
          onChange={(event) => setWarehouseId(event.target.value)}
          required
        >
          <option value="">Choose a warehouse…</option>
          {warehouses.data.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="po-expected">Expected</label>
        <input
          id="po-expected"
          type="date"
          value={expectedAt}
          onChange={(event) => setExpectedAt(event.target.value)}
        />
      </div>

      <StockLineEditor organizationId={organizationId} lines={lines} onChange={setLines} showCost />

      {costError && <p className="workspace-error">{costError}</p>}

      <Button type="submit" disabled={busy || !ready}>
        {busy ? "Saving…" : "Create purchase order"}
      </Button>
    </form>
  );
}
