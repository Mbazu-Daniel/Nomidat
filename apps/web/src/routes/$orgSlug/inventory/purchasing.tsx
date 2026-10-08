import { createFileRoute } from "@tanstack/react-router";
import { useOrgContext } from "@/components/shell/org-context";
import { InventoryShell } from "@/components/inventory/inventory-shell";
import { OperationsPanel } from "@/components/inventory/operations-panel";
import { canWriteArea } from "@/components/workspace/staff-permissions";

export const Route = createFileRoute("/$orgSlug/inventory/purchasing")({
  component: PurchasingPage,
});

function PurchasingPage() {
  const { organization, role } = useOrgContext();
  return (
    <InventoryShell
      title="Purchasing"
      description="Orders you have placed with suppliers and how much has arrived."
    >
      <OperationsPanel
        organizationId={organization.id}
        tab="purchasing"
        canWrite={canWriteArea(role, "inventory")}
      />
    </InventoryShell>
  );
}
