import { getStockMovements, type StockMovement } from "@/data/inventory";
import { useAsyncResource } from "@/lib/use-api-resource";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshButton } from "./inventory-shell";

const TYPE_LABELS: Record<string, string> = {
  inbound_receive: "Received",
  outbound_ship: "Sold",
  transfer_out: "Transferred out",
  transfer_in: "Transferred in",
  adjustment_add: "Adjustment +",
  adjustment_remove: "Adjustment −",
  return_in: "Returned",
  cycle_count_correction: "Count correction",
};

function qty(value: number) {
  return Number(value ?? 0).toLocaleString("en-NG", { maximumFractionDigits: 3 });
}

/**
 * The audit trail: every stock change with the balance before and after, so a
 * seller can always answer "how did this number get here?".
 */
export function MovementsPanel({ organizationId }: { organizationId: string }) {
  const [revision, setRevision] = useState(0);
  const { data, loading, error } = useAsyncResource<StockMovement[]>(
    getStockMovements,
    organizationId,
    [],
    revision,
  );

  return (
    <section className="inventory-panel">
      <div className="inventory-panel-bar">
        <p>{loading ? "Loading history…" : `Last ${data.length} movements`}</p>
        <RefreshButton busy={loading} onClick={() => setRevision((n) => n + 1)} />
      </div>

      {error && <p className="workspace-error">{error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead className="inventory-numeric">Change</TableHead>
            <TableHead className="inventory-numeric">Was</TableHead>
            <TableHead className="inventory-numeric">Now</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
              <TableCell>{row.productName}</TableCell>
              <TableCell>{TYPE_LABELS[row.type] ?? row.type}</TableCell>
              <TableCell
                className={`inventory-numeric ${Number(row.quantity) < 0 ? "inventory-negative" : "inventory-positive"}`}
              >
                {Number(row.quantity) > 0 ? "+" : ""}
                {qty(row.quantity)}
              </TableCell>
              <TableCell className="inventory-numeric">{qty(row.previousBalance)}</TableCell>
              <TableCell className="inventory-numeric">{qty(row.newBalance)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {!loading && !data.length && <p className="inventory-empty">No movements yet.</p>}
    </section>
  );
}
