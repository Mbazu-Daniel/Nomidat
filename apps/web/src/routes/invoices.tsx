import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/components/workspace/workspace-page";

export const Route = createFileRoute("/invoices")({
  component: () => <WorkspacePage section="invoices" />,
});
