import { createFileRoute } from "@tanstack/react-router";
import { useOrgContext } from "@/components/shell/org-context";
import { ChatPanel } from "@/components/workspace/chat-panel";
import { canWriteArea } from "@/components/workspace/staff-permissions";

export const Route = createFileRoute("/$orgSlug/chat")({
  component: ChatPage,
});

function ChatPage() {
  const { organization, role } = useOrgContext();
  return (
    <ChatPanel
      key={organization.id}
      organizationId={organization.id}
      canWrite={canWriteArea(role, "chat")}
    />
  );
}
