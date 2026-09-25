import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/components/workspace/workspace-page";

export const Route = createFileRoute("/sales")({
  component: () => <WorkspacePage section="sales" />,
});
