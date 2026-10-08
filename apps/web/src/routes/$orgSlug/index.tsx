import { createFileRoute } from "@tanstack/react-router";
import { OverviewPanel } from "@/components/workspace/overview-panel";
import { useOrgContext } from "@/components/shell/org-context";

export const Route = createFileRoute("/$orgSlug/")({
  component: OverviewPage,
});

function OverviewPage() {
  const { organization } = useOrgContext();
  return <OverviewPanel key={organization.id} organizationId={organization.id} />;
}
