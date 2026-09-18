import { createFileRoute, Link } from "@tanstack/react-router";
import { IconRocket } from "@tabler/icons-react";

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
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/login"
          className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          Sign in
        </Link>
        <Link
          to="/channels"
          className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-sm font-medium hover:bg-muted"
        >
          Channels
        </Link>
      </div>
    </main>
  );
}
