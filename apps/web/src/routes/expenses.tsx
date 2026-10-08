import { createFileRoute } from "@tanstack/react-router";
import { OrgRedirect } from "@/components/shell/org-redirect";

export const Route = createFileRoute("/expenses")({
  component: () => <OrgRedirect section="expenses" />,
});
