import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReactNode } from "react";

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_transit: "In transit",
  received: "Received",
  cancelled: "Cancelled",
  pending: "Pending",
  ordered: "Ordered",
  partial: "Partly received",
  applied: "Applied",
  counted: "Counted",
};

export interface OperationRow {
  id: string;
  cells: string[];
  action: ReactNode;
}

/** One table shape for all four stock operations, so a status reads the same everywhere. */
export function OperationsTable({
  headers,
  rows,
  error,
  loading,
  empty,
}: {
  headers: string[];
  rows: OperationRow[];
  error: string;
  loading: boolean;
  empty: string;
}) {
  // Loading and failure are stated rather than rendered as an empty table, which
  // is indistinguishable from a shop that has never recorded a transfer.
  if (error)
    return (
      <p className="workspace-error" role="alert">
        {error}
      </p>
    );
  if (loading)
    return (
      <p className="inventory-empty" role="status">
        Loading…
      </p>
    );

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header, index) => (
              <TableHead key={header} className={index === 0 ? "" : "inventory-numeric"}>
                {header}
              </TableHead>
            ))}
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              {row.cells.map((cell, index) => (
                <TableCell key={index} className={index === 0 ? "" : "inventory-numeric"}>
                  {cell}
                </TableCell>
              ))}
              <TableCell>{row.action}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {rows.length === 0 && <p className="inventory-empty">{empty}</p>}
    </>
  );
}
