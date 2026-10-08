import { createFileRoute } from "@tanstack/react-router";
import { useOrgContext } from "@/components/shell/org-context";
import { InventoryShell, useWarehouseFilter } from "@/components/inventory/inventory-shell";
import { StockLevelsPanel } from "@/components/inventory/stock-levels-panel";

export const Route = createFileRoute("/$orgSlug/inventory/")({
  component: StockPage,
});

function StockPage() {
  const { organization } = useOrgContext();
  const warehouseId = useWarehouseFilter();
  return (
    <InventoryShell
      title="Stock"
      description="What you have on hand and what is on the way."
    >
      <StockLevelsPanel organizationId={organization.id} warehouseId={warehouseId} />
    </InventoryShell>
  );
}
