import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/components/workspace/workspace-page";

export const Route = createFileRoute("/inventory")({
  component: () => <WorkspacePage section="inventory" />,
});
