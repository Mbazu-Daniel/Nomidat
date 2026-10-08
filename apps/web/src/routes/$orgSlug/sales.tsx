import { createFileRoute } from "@tanstack/react-router";
import { useOrgContext } from "@/components/shell/org-context";
import { RecordsPanel } from "@/components/workspace/records-panel";
import { canWriteArea } from "@/components/workspace/staff-permissions";

export const Route = createFileRoute("/$orgSlug/sales")({
  component: SalesPage,
});

function SalesPage() {
  const { organization, role } = useOrgContext();
  return (
    <RecordsPanel
      key={organization.id}
      organizationId={organization.id}
      section="sales"
      canWrite={canWriteArea(role, "sales")}
    />
  );
}
