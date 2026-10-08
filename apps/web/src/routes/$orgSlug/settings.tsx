import { createFileRoute } from "@tanstack/react-router";
import { useOrgContext } from "@/components/shell/org-context";
import { SettingsPanel } from "@/components/workspace/settings-panel";

export const Route = createFileRoute("/$orgSlug/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { organization } = useOrgContext();
  return <SettingsPanel key={organization.id} organizationId={organization.id} />;
}
