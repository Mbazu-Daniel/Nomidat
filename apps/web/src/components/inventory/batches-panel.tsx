import { getProducts, type Product } from "@/data/catalog";
import { consumeBatch, getBatches } from "@/data/serials";
import { useAsyncResource } from "@/lib/use-api-resource";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function qty(value: number) {
  return Number(value ?? 0).toLocaleString("en-NG", { maximumFractionDigits: 3 });
}

/** Soonest expiry first, because that is the lot a seller should be selling. */
function expiryLabel(expiresAt: string | null) {
  if (!expiresAt) return "No expiry";
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "Expired";
  if (days === 0) return "Expires today";
  return `Expires in ${days} day${days === 1 ? "" : "s"}`;
}

export function BatchesPanel({
  organizationId,
  canWrite,
}: {
  organizationId: string;
  canWrite: boolean;
}) {
  const [revision, setRevision] = useState(0);
  const [consuming, setConsuming] = useState("");
  const batches = useAsyncResource(getBatches, organizationId, [], revision);
  const products = useAsyncResource<Product[]>(getProducts, organizationId, [], 0);

  async function consume(batchId: string, remaining: number) {
    const raw = window.prompt("How many units left this batch?");
    if (raw === null) return;
    const quantity = Number(raw);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > remaining) {
      toast.error(`Enter a quantity between 1 and ${qty(remaining)}.`);
      return;
    }
    setConsuming(batchId);
    try {
      await consumeBatch(organizationId, batchId, quantity);
      setRevision((n) => n + 1);
      toast.success("Batch updated.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not update the batch");
    } finally {
      setConsuming("");
    }
  }

  return (
    <>
      {batches.error && <p className="workspace-error">{batches.error}</p>}
      <table className="inventory-plain-table">
        <thead>
          <tr>
            <th>Lot code</th>
            <th>Product</th>
            <th>Received</th>
            <th>Used</th>
            <th>Remaining</th>
            <th>Expiry</th>
            {canWrite && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {batches.data.map((row) => {
            const remaining = Number(row.quantityRemaining ?? 0);
            return (
              <tr key={row.id}>
                <td>{row.code}</td>
                <td>{products.data.find((item) => item.id === row.productId)?.name ?? "—"}</td>
                <td className="inventory-numeric">{qty(row.quantityReceived)}</td>
                <td className="inventory-numeric">{qty(row.quantityConsumed)}</td>
                <td className="inventory-numeric inventory-available">{qty(remaining)}</td>
                <td>{expiryLabel(row.expiresAt)}</td>
                {canWrite && (
                  <td>
                    {remaining > 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={consuming === row.id}
                        onClick={() => void consume(row.id, remaining)}
                      >
                        Draw from
                      </Button>
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!batches.loading && !batches.data.length && (
        <p className="inventory-empty">No batches yet.</p>
      )}
    </>
  );
}
