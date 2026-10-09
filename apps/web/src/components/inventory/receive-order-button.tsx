import { getPurchaseOrder, receivePurchaseOrder } from "@/data/stock-operations";
import { useState } from "react";
import { useLoadedResource } from "@/lib/use-api-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface OutstandingLine {
  id: string;
  productId: string;
  variantId: string | null;
  productName: string;
  outstanding: number;
}

/**
 * Receiving a purchase order states what physically arrived, which is often less
 * than what was ordered — a short delivery, a damaged carton. Each line defaults
 * to the outstanding balance so the common case stays one click.
 */
export function ReceiveOrderButton({
  organizationId,
  purchaseOrderId,
  onDone,
}: {
  organizationId: string;
  purchaseOrderId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Receive
      </Button>
    );
  }

  return (
    <ReceiveOrderForm
      organizationId={organizationId}
      purchaseOrderId={purchaseOrderId}
      onCancel={() => setOpen(false)}
      onDone={() => {
        setOpen(false);
        onDone();
      }}
    />
  );
}

function ReceiveOrderForm({
  organizationId,
  purchaseOrderId,
  onCancel,
  onDone,
}: {
  organizationId: string;
  purchaseOrderId: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const loaded = useLoadedResource(
    async () => {
      const order = await getPurchaseOrder(organizationId, purchaseOrderId);
      return order.items.map((item): OutstandingLine => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        // What is still owed on this line. A line already fully received drops
        // to zero and contributes nothing, so it needs no separate handling here.
        outstanding: Math.max(Number(item.quantityOrdered) - Number(item.quantityReceived), 0),
      }));
    },
    [organizationId, purchaseOrderId],
    null,
  );
  const lines = loaded.data;
  const [arrived, setArrived] = useState<Record<string, string>>({});
  const error = loaded.error;
  const [busy, setBusy] = useState(false);
  // A wrong count is a mistake in the form, not a refusal from the API, so it is
  // reported here rather than through the load's error slot.
  const [countError, setCountError] = useState("");

  async function submit() {
    if (!lines) return;
    const items = lines.map((line) => {
      const raw = arrived[line.id];
      const counted = raw === undefined || raw === "" ? line.outstanding : Number(raw);
      return Number.isFinite(counted) && counted >= 0
        ? {
            productId: line.productId,
            variantId: line.variantId ?? undefined,
            countedQuantity: counted,
          }
        : null;
    });

    if (items.some((item) => item === null)) {
      setCountError("Every line needs a quantity of zero or more.");
      return;
    }

    setBusy(true);
    try {
      await receivePurchaseOrder(organizationId, purchaseOrderId, {
        items: items.filter((item) => item !== null),
      });
      toast.success("Goods booked in.");
      onDone();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not receive the order");
      setBusy(false);
    }
  }

  if (error || countError) return <p className="workspace-error">{error || countError}</p>;
  if (!lines) return <p className="inventory-empty">Loading order…</p>;

  return (
    <div className="inventory-receive-form">
      {lines.map((line) => (
        <label key={line.id} className="inventory-line-amount">
          <span>
            {line.productName} · {line.outstanding} outstanding
          </span>
          <Input
            type="number"
            min="0"
            step="0.001"
            inputMode="decimal"
            placeholder={String(line.outstanding)}
            value={arrived[line.id] ?? ""}
            onChange={(event) =>
              setArrived((current) => ({ ...current, [line.id]: event.target.value }))
            }
          />
        </label>
      ))}
      <span className="inventory-receive-actions">
        <Button type="button" size="sm" disabled={busy} onClick={() => void submit()}>
          {busy ? "Receiving…" : "Confirm receipt"}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </span>
    </div>
  );
}
