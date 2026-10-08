import { createReturn } from "@/data/stock-operations";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  StockLineEditor,
  emptyLine,
  parseStockLine,
  type StockLineDraft,
} from "./stock-line-editor";

/**
 * Goods coming back. Restocking decides whether they return to sellable stock or
 * are written off, so it is asked up front rather than inferred at receive time.
 */
export function ReturnForm({
  organizationId,
  onCreated,
}: {
  organizationId: string;
  onCreated: () => void;
}) {
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);
  const [lines, setLines] = useState<StockLineDraft[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);

  const items = lines.map(parseStockLine).filter((line) => line !== null);
  const ready = items.length === lines.length && lines.length > 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await createReturn(organizationId, {
        items: items.map((line) => ({
          productId: line.productId,
          variantId: line.variantId || undefined,
          quantity: line.quantity,
        })),
        restock,
        reason: reason.trim() || undefined,
      });
      setLines([emptyLine()]);
      setReason("");
      onCreated();
      toast.success("Return recorded.");
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "Could not record the return");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="inventory-create-form inventory-operation-form" onSubmit={submit}>
      <div>
        <label htmlFor="return-reason">Reason</label>
        <input
          id="return-reason"
          value={reason}
          maxLength={255}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Damaged in transit"
        />
      </div>
      <label className="inventory-checkbox">
        <input
          type="checkbox"
          checked={restock}
          onChange={(event) => setRestock(event.target.checked)}
        />
        Put back into sellable stock
      </label>

      <StockLineEditor organizationId={organizationId} lines={lines} onChange={setLines} />

      <Button type="submit" disabled={busy || !ready}>
        {busy ? "Saving…" : "Record return"}
      </Button>
    </form>
  );
}
