import { Link } from "@tanstack/react-router";
import { useOrgContext } from "@/components/shell/org-context";
import { canWriteArea } from "@/components/workspace/staff-permissions";
import { Button } from "@/components/ui/button";
import { createContext, useContext, useState, type ReactNode } from "react";
import { useAsyncResource } from "@/lib/use-api-resource";
import { getWarehouses, type Warehouse } from "@/data/inventory";
import "./inventory.css";

const TABS = [
  { to: "/$orgSlug/inventory", label: "Stock" },
  { to: "/$orgSlug/inventory/movements", label: "History" },
  { to: "/$orgSlug/inventory/warehouses", label: "Warehouses" },
  { to: "/$orgSlug/inventory/catalog", label: "Catalog" },
  { to: "/$orgSlug/inventory/transfers", label: "Transfers" },
  { to: "/$orgSlug/inventory/counts", label: "Counts" },
  { to: "/$orgSlug/inventory/purchasing", label: "Purchasing" },
  { to: "/$orgSlug/inventory/returns", label: "Returns" },
  { to: "/$orgSlug/inventory/tracked", label: "Serials & batches" },
] as const;

/** Shared chrome for every inventory screen: title, tabs, and the warehouse picker. */
const InventoryShellContext = createContext<string>("");

export function useWarehouseFilter() {
  return useContext(InventoryShellContext);
}

export function InventoryShell({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const { organization, role } = useOrgContext();
  const [warehouseId, setWarehouseId] = useState("");
  const { data: warehouses, loading } = useAsyncResource<Warehouse[]>(
    getWarehouses,
    organization.id,
    [],
  );

  return (
    <InventoryShellContext.Provider value={warehouseId}>
      <div className="workspace-page inventory-page">
        <header className="workspace-page-header">
          <div>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          {canWriteArea(role, "inventory") && <div className="inventory-actions">{actions}</div>}
        </header>

        <nav className="inventory-tabs" aria-label="Inventory sections">
          {TABS.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              params={{ orgSlug: organization.slug }}
              className="inventory-tab"
              activeProps={{ className: "active" }}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="inventory-warehouse-filter">
          <label htmlFor="inventory-warehouse">Warehouse</label>
          <select
            id="inventory-warehouse"
            value={warehouseId}
            disabled={loading}
            onChange={(event) => setWarehouseId(event.target.value)}
          >
            <option value="">All warehouses</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </div>

        {children}
      </div>
    </InventoryShellContext.Provider>
  );
}

export function RefreshButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <Button type="button" variant="outline" onClick={onClick} disabled={busy}>
      {busy ? "Refreshing…" : "Refresh"}
    </Button>
  );
}
