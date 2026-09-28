import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/components/workspace/workspace-page";

export const Route = createFileRoute("/mini-app")({
  component: () => <WorkspacePage section="overview" miniApp />,
  head: () => ({ scripts: [{ src: "https://telegram.org/js/telegram-web-app.js" }] }),
});
