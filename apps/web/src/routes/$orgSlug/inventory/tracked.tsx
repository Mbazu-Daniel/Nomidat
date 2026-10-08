import { createFileRoute } from "@tanstack/react-router";
import { useOrgContext } from "@/components/shell/org-context";
import { InventoryShell } from "@/components/inventory/inventory-shell";
import { TrackedStockPanel } from "@/components/inventory/tracked-stock-panel";
import { canWriteArea } from "@/components/workspace/staff-permissions";

export const Route = createFileRoute("/$orgSlug/inventory/tracked")({
  component: TrackedStockPage,
});

function TrackedStockPage() {
  const { organization, role } = useOrgContext();
  return (
    <InventoryShell
      title="Tracked stock"
      description="Units you follow individually, and lots you draw down as a batch."
    >
      <TrackedStockPanel
        organizationId={organization.id}
        canWrite={canWriteArea(role, "inventory")}
      />
    </InventoryShell>
  );
}
