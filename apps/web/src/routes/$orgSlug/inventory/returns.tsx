import { createFileRoute } from "@tanstack/react-router";
import { useOrgContext } from "@/components/shell/org-context";
import { InventoryShell } from "@/components/inventory/inventory-shell";
import { OperationsPanel } from "@/components/inventory/operations-panel";
import { canWriteArea } from "@/components/workspace/staff-permissions";

export const Route = createFileRoute("/$orgSlug/inventory/returns")({
  component: ReturnsPage,
});

function ReturnsPage() {
  const { organization, role } = useOrgContext();
  return (
    <InventoryShell
      title="Returns"
      description="Goods coming back. Decide whether they return to sellable stock."
    >
      <OperationsPanel
        organizationId={organization.id}
        tab="returns"
        canWrite={canWriteArea(role, "inventory")}
      />
    </InventoryShell>
  );
}
