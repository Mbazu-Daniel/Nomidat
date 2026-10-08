import { createFileRoute } from "@tanstack/react-router";
import { useOrgContext } from "@/components/shell/org-context";
import { InventoryShell } from "@/components/inventory/inventory-shell";
import { OperationsPanel } from "@/components/inventory/operations-panel";
import { canWriteArea } from "@/components/workspace/staff-permissions";

export const Route = createFileRoute("/$orgSlug/inventory/transfers")({
  component: TransfersPage,
});

function TransfersPage() {
  const { organization, role } = useOrgContext();
  return (
    <InventoryShell
      title="Stock transfers"
      description="Move stock between your warehouses, and see what is still in transit."
    >
      <OperationsPanel
        organizationId={organization.id}
        tab="transfers"
        canWrite={canWriteArea(role, "inventory")}
      />
    </InventoryShell>
  );
}
