import { createFileRoute } from "@tanstack/react-router";
import { useOrgContext } from "@/components/shell/org-context";
import { CatalogPanel } from "@/components/inventory/catalog-panel";
import { InventoryShell } from "@/components/inventory/inventory-shell";
import { canWriteArea } from "@/components/workspace/staff-permissions";

export const Route = createFileRoute("/$orgSlug/inventory/catalog")({
  component: CatalogPage,
});

function CatalogPage() {
  const { organization, role } = useOrgContext();
  return (
    <InventoryShell
      title="Catalog"
      description="Group your products, choose how they are measured, and keep suppliers close."
    >
      <CatalogPanel organizationId={organization.id} canWrite={canWriteArea(role, "inventory")} />
    </InventoryShell>
  );
}
