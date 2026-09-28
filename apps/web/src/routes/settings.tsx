import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/components/workspace/workspace-page";
export const Route = createFileRoute("/settings")({
  component: () => <WorkspacePage section="settings" />,
});
