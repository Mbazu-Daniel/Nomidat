import {
  AuthDivider,
  AuthError,
  AuthField,
  AuthShell,
  PasswordField,
} from "@/components/auth/auth-shell";
import { TelegramSignIn } from "@/components/auth/telegram-sign-in";
import { Button } from "@/components/ui/button";
import { authClient, signInWithTelegramWidget, TELEGRAM_BOT_USERNAME } from "@/lib/api";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { IconBrandGoogle } from "@tabler/icons-react";
import { useState, useTransition, type FormEvent } from "react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

/** Where to land after signing in, when the user has no business yet. */
const ONBOARDING_PATH = "/onboarding";

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /** Onboarding is where a signed-in user without a business is sent. */
  async function goToWorkspace() {
    await navigate({ to: "/" });
  }

  function signInWithEmail(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      setError(null);
      const { error: signInError } = await authClient.signIn.email({ email, password });
      if (signInError) {
        setError(signInError.message ?? "That email and password did not match.");
        return;
      }
      await goToWorkspace();
    });
  }

  function signInWithGoogle() {
    startTransition(async () => {
      setError(null);
      // Better Auth issues the redirect itself, so the browser leaves the page
      // and there is nothing to navigate back to on success.
      const { error: socialError } = await authClient.signIn.social({
        provider: "google",
        callbackURL: `${window.location.origin}${ONBOARDING_PATH}`,
      });
      if (socialError) setError(socialError.message ?? "Google sign-in failed.");
    });
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Enter your email and password to access your account."
      showcase={{
        headline: "Run your business from one place.",
        body: "Sales, stock, invoices and customers, kept in step whether you are at the till or on the road.",
        points: [
          "Track every sale and stock movement",
          "Send invoices and take payment online",
          "Publish a shop your customers can order from",
        ],
      }}
      footer={
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          {/* `/register` is now only a legacy alias, so this points straight at the
              step that actually renders the form. `search` is required because
              `/onboarding` declares a validated search param. */}
          <Link
            to="/onboarding"
            search={{ step: undefined }}
            className="font-medium text-primary hover:underline"
          >
            Register now
          </Link>
        </p>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={signInWithEmail} noValidate>
        <AuthField
          label="Email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@yourbusiness.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <PasswordField
          label="Password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <AuthError message={error} />

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Signing in…" : "Log in"}
        </Button>
      </form>

      <AuthDivider>or log in with</AuthDivider>

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={signInWithGoogle}
          disabled={pending}
        >
          <IconBrandGoogle />
          Google
        </Button>
        {TELEGRAM_BOT_USERNAME && (
          <TelegramSignIn
            botUsername={TELEGRAM_BOT_USERNAME}
            onVerified={async (data) => {
              await signInWithTelegramWidget(data);
              await goToWorkspace();
            }}
          />
        )}
      </div>
    </AuthShell>
  );
}
