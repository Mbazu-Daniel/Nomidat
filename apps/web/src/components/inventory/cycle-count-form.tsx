import { createCycleCount } from "@/data/stock-operations";
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

export function CycleCountForm({
  organizationId,
  onCreated,
}: {
  organizationId: string;
  onCreated: () => void;
}) {
  const warehouses = useWarehouses(organizationId);
  const [warehouseId, setWarehouseId] = useState("");
  const [lines, setLines] = useState<StockLineDraft[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);

  const items = lines.map(parseCountedLine).filter((line) => line !== null);
  const ready = warehouseId !== "" && items.length === lines.length && lines.length > 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await createCycleCount(organizationId, {
        warehouseId,
        items: items.map((line) => ({
          productId: line.productId,
          variantId: line.variantId || undefined,
          countedQuantity: line.quantity,
        })),
      });
      setLines([emptyLine()]);
      onCreated();
      toast.success("Count recorded. Apply it to post the difference.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not record the count");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="inventory-create-form inventory-operation-form" onSubmit={submit}>
      <div>
        <label htmlFor="count-warehouse">Warehouse</label>
        <select
          id="count-warehouse"
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

      <StockLineEditor
        organizationId={organizationId}
        lines={lines}
        onChange={setLines}
        quantityLabel="Counted"
      />

      <Button type="submit" disabled={busy || !ready}>
        {busy ? "Saving…" : "Record count"}
      </Button>
    </form>
  );
}
