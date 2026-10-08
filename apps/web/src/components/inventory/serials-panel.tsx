import { getProducts, type Product } from "@/data/catalog";
import {
  getSerials,
  updateSerialStatus,
  type SerialNumberRow,
  type SerialStatus,
} from "@/data/serials";
import { useAsyncResource } from "@/lib/use-api-resource";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const STATUS_LABELS: Record<SerialStatus, string> = {
  in_stock: "In stock",
  sold: "Sold",
  returned: "Returned",
  void: "Void",
};

/**
 * The transitions the API allows. Kept beside the labels so a status the API
 * would refuse is never offered — the guard there is real, not cosmetic.
 */
const NEXT_STATUS: Record<SerialStatus, SerialStatus[]> = {
  in_stock: ["void"],
  sold: ["returned"],
  returned: ["in_stock", "void"],
  void: [],
};

export function SerialsPanel({
  organizationId,
  canWrite,
}: {
  organizationId: string;
  canWrite: boolean;
}) {
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState("");
  const serials = useAsyncResource(getSerials, organizationId, [], revision);
  const products = useAsyncResource<Product[]>(getProducts, organizationId, [], 0);

  async function move(row: SerialNumberRow, status: SerialStatus) {
    setBusyId(row.id);
    try {
      await updateSerialStatus(organizationId, row.id, status);
      setRevision((n) => n + 1);
      toast.success(`${row.code} is now ${STATUS_LABELS[status].toLowerCase()}.`);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not update that unit");
    } finally {
      setBusyId("");
    }
  }

  function productName(productId: string) {
    return products.data.find((item) => item.id === productId)?.name ?? "—";
  }

  return (
    <>
      {serials.error && <p className="workspace-error">{serials.error}</p>}
      <table className="inventory-plain-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Product</th>
            <th>Status</th>
            <th>Sold on</th>
            {canWrite && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {serials.data.map((row) => (
            <tr key={row.id}>
              <td className="inventory-code">{row.code}</td>
              <td>{productName(row.productId)}</td>
              <td>
                <span
                  className={`inventory-status inventory-status-${row.status.replace("_", "-")}`}
                >
                  {STATUS_LABELS[row.status]}
                </span>
              </td>
              <td>{row.orderId ? new Date(row.soldAt ?? 0).toLocaleDateString() : "—"}</td>
              {canWrite && (
                <td className="inventory-row-actions">
                  {NEXT_STATUS[row.status].length === 0 && <span>—</span>}
                  {NEXT_STATUS[row.status].map((status) => (
                    <Button
                      key={status}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === row.id}
                      onClick={() => void move(row, status)}
                    >
                      Mark {STATUS_LABELS[status].toLowerCase()}
                    </Button>
                  ))}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!serials.loading && !serials.data.length && (
        <p className="inventory-empty">No tracked units yet.</p>
      )}
    </>
  );
}
