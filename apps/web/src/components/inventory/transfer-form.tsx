import { createTransfer } from "@/data/stock-operations";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  StockLineEditor,
  emptyLine,
  parseStockLine,
  type StockLineDraft,
} from "./stock-line-editor";
import { useWarehouses } from "./use-warehouses";

export function TransferForm({
  organizationId,
  onCreated,
}: {
  organizationId: string;
  onCreated: () => void;
}) {
  const warehouses = useWarehouses(organizationId);
  const [fromWarehouseId, setFrom] = useState("");
  const [toWarehouseId, setTo] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<StockLineDraft[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);

  const items = lines.map(parseStockLine).filter((line) => line !== null);
  const sameWarehouse = Boolean(fromWarehouseId) && fromWarehouseId === toWarehouseId;
  const ready =
    fromWarehouseId !== "" &&
    toWarehouseId !== "" &&
    !sameWarehouse &&
    items.length === lines.length &&
    lines.length > 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await createTransfer(organizationId, {
        fromWarehouseId,
        toWarehouseId,
        items: items.map((line) => ({
          productId: line.productId,
          variantId: line.variantId || undefined,
          quantity: line.quantity,
        })),
        notes: notes.trim() || undefined,
      });
      setLines([emptyLine()]);
      setNotes("");
      onCreated();
      toast.success("Transfer created as a draft. Dispatch it to move the goods.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not create transfer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="inventory-create-form inventory-operation-form" onSubmit={submit}>
      <div>
        <label htmlFor="transfer-from">From</label>
        <select
          id="transfer-from"
          value={fromWarehouseId}
          onChange={(event) => setFrom(event.target.value)}
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
        <label htmlFor="transfer-to">To</label>
        <select
          id="transfer-to"
          value={toWarehouseId}
          onChange={(event) => setTo(event.target.value)}
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
        <label htmlFor="transfer-notes">Notes</label>
        <input
          id="transfer-notes"
          value={notes}
          maxLength={500}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Optional"
        />
      </div>

      {sameWarehouse && <p className="workspace-error">Pick two different warehouses.</p>}

      <StockLineEditor organizationId={organizationId} lines={lines} onChange={setLines} />

      <Button type="submit" disabled={busy || !ready}>
        {busy ? "Saving…" : "Create transfer"}
      </Button>
    </form>
  );
}
