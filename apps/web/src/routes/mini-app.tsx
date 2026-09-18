import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createTelegramSession } from "@/lib/telegram-session";
import "@/lib/types/telegram-web-app.type";

export const Route = createFileRoute("/mini-app")({
  component: MiniAppPage,
  head: () => ({
    scripts: [
      {
        src: "https://telegram.org/js/telegram-web-app.js",
      },
    ],
  }),
});

function MiniAppPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("Opening Telegram session…");
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void createTelegramSession(window.Telegram?.WebApp).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setUserName(result.userName);
        setStatus("ready");
        setMessage("Signed in with Telegram.");
      } else {
        setStatus("error");
        setMessage(result.message);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
      <p className="text-sm text-muted-foreground">nomidat</p>
      <h1 className="text-3xl font-semibold tracking-tight">Mini App</h1>
      <p className="text-muted-foreground">{message}</p>
      {status === "ready" && userName ? (
        <div className="flex flex-col gap-4">
          <p className="text-lg">Welcome, {userName}</p>
          <Link to="/channels" className="text-sm font-medium underline underline-offset-4">
            Manage channels
          </Link>
        </div>
      ) : null}
      {status === "error" ? (
        <Link to="/login" className="text-sm font-medium underline underline-offset-4">
          Sign in on the web instead
        </Link>
      ) : null}
    </main>
  );
}
