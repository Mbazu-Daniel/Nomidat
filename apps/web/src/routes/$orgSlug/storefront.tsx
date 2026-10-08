import { createFileRoute } from "@tanstack/react-router";
import { useOrgContext } from "@/components/shell/org-context";
import { StorefrontSettingsPanel } from "@/components/storefront/storefront-settings-panel";

export const Route = createFileRoute("/$orgSlug/storefront")({
  component: StorefrontSettingsPage,
});

function StorefrontSettingsPage() {
  const { organization } = useOrgContext();
  return <StorefrontSettingsPanel key={organization.id} organizationId={organization.id} />;
}
