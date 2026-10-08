import { useWarehouses } from "./use-warehouses";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * A return lands in a warehouse the seller names at the moment it arrives, so
 * the choice is part of the action rather than a field set earlier.
 */
export function ReceiveReturnButton({
  organizationId,
  busy,
  onReceive,
}: {
  organizationId: string;
  busy: boolean;
  onReceive: (warehouseId: string) => void;
}) {
  const warehouses = useWarehouses(organizationId);
  const [warehouseId, setWarehouseId] = useState("");
  const noWarehouses = !warehouses.loading && warehouses.data.length === 0;

  return (
    <span className="inventory-receive">
      <select
        aria-label="Receive into warehouse"
        value={warehouseId}
        onChange={(event) => setWarehouseId(event.target.value)}
      >
        <option value="">Choose a warehouse…</option>
        {warehouses.data.map((warehouse) => (
          <option key={warehouse.id} value={warehouse.id}>
            {warehouse.name}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        disabled={busy || !warehouseId}
        onClick={() => onReceive(warehouseId)}
      >
        Receive
      </Button>
      {noWarehouses && <span className="inventory-chip-meta">Add a warehouse first.</span>}
    </span>
  );
}
