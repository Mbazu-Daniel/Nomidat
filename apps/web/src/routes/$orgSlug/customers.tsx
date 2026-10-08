import { createFileRoute } from "@tanstack/react-router";
import { useOrgContext } from "@/components/shell/org-context";
import { RecordsPanel } from "@/components/workspace/records-panel";
import { canWriteArea } from "@/components/workspace/staff-permissions";

export const Route = createFileRoute("/$orgSlug/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const { organization, role } = useOrgContext();
  return (
    <RecordsPanel
      key={organization.id}
      organizationId={organization.id}
      section="customers"
      canWrite={canWriteArea(role, "customers")}
    />
  );
}
