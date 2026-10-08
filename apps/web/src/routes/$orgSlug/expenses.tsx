import { createFileRoute } from "@tanstack/react-router";
import { useOrgContext } from "@/components/shell/org-context";
import { RecordsPanel } from "@/components/workspace/records-panel";
import { canWriteArea } from "@/components/workspace/staff-permissions";

export const Route = createFileRoute("/$orgSlug/expenses")({
  component: ExpensesPage,
});

function ExpensesPage() {
  const { organization, role } = useOrgContext();
  return (
    <RecordsPanel
      key={organization.id}
      organizationId={organization.id}
      section="expenses"
      canWrite={canWriteArea(role, "expenses")}
    />
  );
}
