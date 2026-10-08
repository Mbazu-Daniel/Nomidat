import { createFileRoute } from "@tanstack/react-router";
import { useOrgContext } from "@/components/shell/org-context";
import { InventoryShell } from "@/components/inventory/inventory-shell";
import { OperationsPanel } from "@/components/inventory/operations-panel";
import { canWriteArea } from "@/components/workspace/staff-permissions";

export const Route = createFileRoute("/$orgSlug/inventory/counts")({
  component: CountsPage,
});

function CountsPage() {
  const { organization, role } = useOrgContext();
  return (
    <InventoryShell
      title="Stock counts"
      description="Count what is on the shelf and post the difference as a correction."
    >
      <OperationsPanel
        organizationId={organization.id}
        tab="counts"
        canWrite={canWriteArea(role, "inventory")}
      />
    </InventoryShell>
  );
}
