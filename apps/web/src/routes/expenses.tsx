import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/components/workspace/workspace-page";

export const Route = createFileRoute("/expenses")({
  component: () => <WorkspacePage section="expenses" />,
});
