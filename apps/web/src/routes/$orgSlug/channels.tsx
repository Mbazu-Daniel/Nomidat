import { createFileRoute } from "@tanstack/react-router";
import { useOrgContext } from "@/components/shell/org-context";
import { ChannelsPanel } from "@/components/workspace/channels-panel";
import { canWriteArea } from "@/components/workspace/staff-permissions";

export const Route = createFileRoute("/$orgSlug/channels")({
  component: ChannelsPage,
});

function ChannelsPage() {
  const { organization, role } = useOrgContext();
  return (
    <ChannelsPanel
      key={organization.id}
      organizationId={organization.id}
      canWrite={canWriteArea(role, "channels")}
    />
  );
}
