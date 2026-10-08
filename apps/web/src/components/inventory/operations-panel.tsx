import {
  applyCycleCount,
  cancelTransfer,
  dispatchTransfer,
  getCycleCounts,
  getPurchaseOrders,
  getReturns,
  getTransfers,
  receiveReturn,
  receiveTransfer,
  type CycleCount,
  type PurchaseOrder,
  type StockReturn,
  type StockTransfer,
} from "@/data/stock-operations";
import { useAsyncResource } from "@/lib/use-api-resource";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CycleCountForm } from "./cycle-count-form";
import { PurchaseOrderForm } from "./purchase-order-form";
import { ReturnForm } from "./return-form";
import { TransferForm } from "./transfer-form";
import { ReceiveOrderButton } from "./receive-order-button";
import { ReceiveReturnButton } from "./receive-return-button";
import { OperationsTable, STATUS_LABELS } from "./operations-table";

export type OperationsTab = "transfers" | "counts" | "purchasing" | "returns";

const TABS: { id: OperationsTab; label: string }[] = [
  { id: "transfers", label: "Transfers" },
  { id: "counts", label: "Stock counts" },
  { id: "purchasing", label: "Purchase orders" },
  { id: "returns", label: "Returns" },
];

/**
 * Transfers, counts, purchase orders and returns.
 *
 * The route names the tab, so `/inventory/counts` opens on counts instead of
 * whichever tab happened to be declared first.
 */
export function OperationsPanel({
  organizationId,
  tab: initialTab = "transfers",
  canWrite,
}: {
  organizationId: string;
  tab?: OperationsTab;
  canWrite: boolean;
}) {
  const [tab, setTab] = useState<OperationsTab>(initialTab);
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState("");

  // Only the open tab loads; the rest would be four requests the seller never
  // looks at. Paths live in the data layer, so there is one place to change them.
  const transfers = useAsyncResource<StockTransfer[]>(
    getTransfers,
    tab === "transfers" ? organizationId : null,
    [],
    revision,
  );
  const counts = useAsyncResource<CycleCount[]>(
    getCycleCounts,
    tab === "counts" ? organizationId : null,
    [],
    revision,
  );
  const orders = useAsyncResource<PurchaseOrder[]>(
    getPurchaseOrders,
    tab === "purchasing" ? organizationId : null,
    [],
    revision,
  );
  const returns = useAsyncResource<StockReturn[]>(
    getReturns,
    tab === "returns" ? organizationId : null,
    [],
    revision,
  );

  // The resource for the open tab, so each table reports its own state instead of
  // four of them repeating it.
  const active = { transfers, counts, purchasing: orders, returns }[tab];

  async function act(id: string, run: () => Promise<unknown>) {
    setBusyId(id);
    try {
      await run();
      setRevision((n) => n + 1);
      toast.success("Done");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not complete");
    } finally {
      setBusyId("");
    }
  }

  const refreshed = () => setRevision((n) => n + 1);

  return (
    <section className="inventory-panel">
      <div className="inventory-subtabs" role="tablist" aria-label="Stock operations">
        {TABS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={tab === option.id}
            className={`inventory-subtab ${tab === option.id ? "active" : ""}`}
            onClick={() => setTab(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {canWrite && tab === "transfers" && (
        <TransferForm organizationId={organizationId} onCreated={refreshed} />
      )}
      {canWrite && tab === "counts" && (
        <CycleCountForm organizationId={organizationId} onCreated={refreshed} />
      )}
      {canWrite && tab === "purchasing" && (
        <PurchaseOrderForm organizationId={organizationId} onCreated={refreshed} />
      )}
      {canWrite && tab === "returns" && (
        <ReturnForm organizationId={organizationId} onCreated={refreshed} />
      )}

      {tab === "transfers" && (
        <OperationsTable
          headers={["Reference", "Status"]}
          error={active.error}
          loading={active.loading}
          empty="No transfers yet."
          rows={transfers.data.map((row) => ({
            id: row.id,
            cells: [row.reference, STATUS_LABELS[row.status] ?? row.status],
            action: (
              <TransferAction
                row={row}
                busy={busyId === row.id}
                canWrite={canWrite}
                onAct={() =>
                  act(row.id, () =>
                    row.status === "draft"
                      ? dispatchTransfer(organizationId, row.id)
                      : receiveTransfer(organizationId, row.id),
                  )
                }
                onCancel={() => act(row.id, () => cancelTransfer(organizationId, row.id))}
              />
            ),
          }))}
        />
      )}

      {tab === "counts" && (
        <OperationsTable
          headers={["Reference", "Status"]}
          error={active.error}
          loading={active.loading}
          empty="No counts yet."
          rows={counts.data.map((row) => ({
            id: row.id,
            cells: [row.reference, STATUS_LABELS[row.status] ?? row.status],
            action:
              row.status === "counted" && canWrite ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === row.id}
                  onClick={() => void act(row.id, () => applyCycleCount(organizationId, row.id))}
                >
                  Apply correction
                </Button>
              ) : (
                <span>—</span>
              ),
          }))}
        />
      )}

      {tab === "purchasing" && (
        <OperationsTable
          headers={["Reference", "Status"]}
          error={active.error}
          loading={active.loading}
          empty="No purchase orders yet."
          rows={orders.data.map((row) => ({
            id: row.id,
            cells: [row.reference, STATUS_LABELS[row.status] ?? row.status],
            action:
              canWrite && (row.status === "ordered" || row.status === "partial") ? (
                <ReceiveOrderButton
                  organizationId={organizationId}
                  purchaseOrderId={row.id}
                  onDone={refreshed}
                />
              ) : (
                <span>—</span>
              ),
          }))}
        />
      )}

      {tab === "returns" && (
        <OperationsTable
          headers={["Reference", "Status", "Restock"]}
          error={active.error}
          loading={active.loading}
          empty="No returns yet."
          rows={returns.data.map((row) => ({
            id: row.id,
            cells: [
              row.reference,
              STATUS_LABELS[row.status] ?? row.status,
              row.restock ? "Yes" : "No",
            ],
            action:
              row.status === "pending" && canWrite ? (
                <ReceiveReturnButton
                  organizationId={organizationId}
                  busy={busyId === row.id}
                  onReceive={(warehouseId) =>
                    void act(row.id, () => receiveReturn(organizationId, row.id, warehouseId))
                  }
                />
              ) : (
                <span>—</span>
              ),
          }))}
        />
      )}
    </section>
  );
}

function TransferAction({
  row,
  busy,
  canWrite,
  onAct,
  onCancel,
}: {
  row: StockTransfer;
  busy: boolean;
  canWrite: boolean;
  onAct: () => void;
  onCancel: () => void;
}) {
  if (row.status !== "draft" && row.status !== "in_transit") return <span>—</span>;
  return (
    <span className="inventory-row-actions">
      <Button type="button" size="sm" disabled={busy} onClick={onAct}>
        {row.status === "draft" ? "Dispatch" : "Receive"}
      </Button>
      {/* Cancelling undoes stock, so it needs write access; the main action
          stays as it was. */}
      {canWrite && (
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      )}
    </span>
  );
}
