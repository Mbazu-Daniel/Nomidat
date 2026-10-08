import { createFileRoute } from "@tanstack/react-router";
import { PlatformConsole } from "@/components/workspace/platform-console";
import "./platform.css";

export const Route = createFileRoute("/platform")({
  component: PlatformPage,
});

function PlatformPage() {
  return (
    <main className="workspace-shell">
      <PlatformConsole />
    </main>
  );
}
