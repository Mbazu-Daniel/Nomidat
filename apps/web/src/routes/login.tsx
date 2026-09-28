import { PhoneSignIn } from "@/components/auth/phone-sign-in";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { createApiRequest } from "@/lib/api";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function createEmailSession(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      try {
        setError(null);
        await createApiRequest("/auth/sign-in/email", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        await navigate({ to: "/" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign-in failed");
      }
    });
  }

  function createGoogleSession() {
    startTransition(async () => {
      try {
        setError(null);
        const result = await createApiRequest<{ url?: string }>("/auth/sign-in/google", {
          method: "POST",
          body: JSON.stringify({
            callbackURL: `${window.location.origin}/`,
          }),
        });
        if (result.url) {
          window.location.href = result.url;
          return;
        }
        await navigate({ to: "/" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Google sign-in failed");
      }
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← nomidat
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground">
          Web login with email or Google. Telegram users open the Mini App from the bot.
        </p>
      </header>

      <PhoneSignIn />
      <form className="flex flex-col gap-4" onSubmit={createEmailSession}>
        <label className="flex flex-col gap-1.5 text-sm" htmlFor="email">
          Email
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm" htmlFor="password">
          Password
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <Button type="submit" disabled={pending}>
          Sign in
        </Button>
      </form>

      <Button type="button" variant="outline" onClick={createGoogleSession} disabled={pending}>
        Continue with Google
      </Button>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </main>
  );
}
