import { createFileRoute } from "@tanstack/react-router";
import { useOrgContext } from "@/components/shell/org-context";
import { InventoryShell } from "@/components/inventory/inventory-shell";
import { WarehousesPanel } from "@/components/inventory/warehouses-panel";
import { canWriteArea } from "@/components/workspace/staff-permissions";

export const Route = createFileRoute("/$orgSlug/inventory/warehouses")({
  component: WarehousesPage,
});

function WarehousesPage() {
  const { organization, role } = useOrgContext();
  return (
    <InventoryShell
      title="Warehouses"
      description="The places your stock is held, such as your main store or a stall."
    >
      <WarehousesPanel
        organizationId={organization.id}
        canWrite={canWriteArea(role, "inventory")}
      />
    </InventoryShell>
  );
}
