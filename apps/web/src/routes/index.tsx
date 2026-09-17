import { createFileRoute } from "@tanstack/react-router";
import { IconRocket } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background text-foreground">
      <div className="flex items-center gap-3">
        <IconRocket className="size-10 text-primary" />
        <h1 className="text-4xl font-semibold tracking-tight">nomidat</h1>
      </div>
      <p className="text-muted-foreground">Built with TanStack Start</p>
      <Button type="button">Get started</Button>
    </main>
  );
}
