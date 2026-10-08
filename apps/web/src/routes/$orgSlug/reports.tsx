import { createFileRoute } from "@tanstack/react-router";
import { useOrgContext } from "@/components/shell/org-context";
import { ReportsPanel } from "@/components/workspace/reports-panel";

export const Route = createFileRoute("/$orgSlug/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { organization } = useOrgContext();
  return <ReportsPanel key={organization.id} organizationId={organization.id} />;
}
