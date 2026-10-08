import { getStockLevels, type StockLevel } from "@/data/inventory";
import { useAsyncResource } from "@/lib/use-api-resource";
import { useCallback, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshButton } from "./inventory-shell";

function qty(value: number) {
  return Number(value ?? 0).toLocaleString("en-NG", { maximumFractionDigits: 3 });
}

/** What is actually on the shelf, and how much of it is already spoken for. */
export function StockLevelsPanel({
  organizationId,
  warehouseId,
}: {
  organizationId: string;
  warehouseId: string;
}) {
  const [revision, setRevision] = useState(0);
  // Stable identity, because the hook refetches whenever the loader changes and
  // an inline closure would refetch on every render.
  const load = useCallback(
    () => getStockLevels(organizationId, warehouseId),
    [organizationId, warehouseId],
  );
  const { data, loading, error } = useAsyncResource<StockLevel[]>(
    load,
    organizationId,
    [],
    revision,
  );

  return (
    <section className="inventory-panel">
      <div className="inventory-panel-bar">
        <p>
          {loading ? "Loading stock…" : `${data.length} stock line${data.length === 1 ? "" : "s"}`}
        </p>
        <RefreshButton busy={loading} onClick={() => setRevision((n) => n + 1)} />
      </div>

      {error && <p className="workspace-error">{error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead className="inventory-numeric">On hand</TableHead>
            <TableHead className="inventory-numeric">In transit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.productName}</TableCell>
              <TableCell>{row.sku ?? "—"}</TableCell>
              <TableCell className="inventory-numeric">
                {qty(row.onHand)} {row.unit}
              </TableCell>
              <TableCell className="inventory-numeric">{qty(row.inTransit)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {!loading && !data.length && (
        <p className="inventory-empty">No stock recorded yet. Receive stock to get started.</p>
      )}
    </section>
  );
}
