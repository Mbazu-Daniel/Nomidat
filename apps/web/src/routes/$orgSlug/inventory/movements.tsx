import { createFileRoute } from "@tanstack/react-router";
import { useOrgContext } from "@/components/shell/org-context";
import { InventoryShell } from "@/components/inventory/inventory-shell";
import { MovementsPanel } from "@/components/inventory/movements-panel";

export const Route = createFileRoute("/$orgSlug/inventory/movements")({
  component: MovementsPage,
});

function MovementsPage() {
  const { organization } = useOrgContext();
  return (
    <InventoryShell
      title="Stock history"
      description="Every change to your stock, with the balance before and after."
    >
      <MovementsPanel organizationId={organization.id} />
    </InventoryShell>
  );
}
