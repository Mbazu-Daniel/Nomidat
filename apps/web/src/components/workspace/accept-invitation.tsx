import { useState } from "react";
import { useLoadedResource } from "@/lib/use-api-resource";
import { Link } from "@tanstack/react-router";
import { authClient, createApiRequest } from "@/lib/api";
import { clearSession } from "@/lib/session";
import type { StaffInvitation } from "./types/staff.type";
import { staffRoles } from "./staff-roles";

export function AcceptInvitation({ invitationId }: { invitationId: string }) {
  const [busy, setBusy] = useState(false);
  const [signUp, setSignUp] = useState(false);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(false);
  // Bumped after signing in or out, so the session is read again: an invitation is
  // only readable once the account is verified, and signing out must drop it.
  const [revision, setRevision] = useState(0);
  const loaded = useLoadedResource(
    async () => {
      const { data: session } = await authClient.getSession();
      const user = session?.user as
        | { id: string; email: string; emailVerified: boolean }
        | undefined;
      return {
        user,
        invitation: user?.emailVerified
          ? await createApiRequest<StaffInvitation>(`/invitations/${invitationId}`)
          : undefined,
      };
    },
    [invitationId, revision],
    { user: undefined, invitation: undefined } as {
      user: { id: string; email: string; emailVerified: boolean } | undefined;
      invitation: StaffInvitation | undefined;
    },
  );
  const invitation = loaded.data.invitation;
  const signedIn = Boolean(loaded.data.user);
  const email = loaded.data.user?.email ?? "";
  const accountId = loaded.data.user?.id ?? "";
  const verified = Boolean(loaded.data.user?.emailVerified);
  const loading = loaded.loading;
  function renderSignIn() {
    return (
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          setBusy(true);
          setError("");
          try {
            const credentials = {
              email: String(fields.get("email")).trim(),
              password: String(fields.get("password")),
            };
            const { error: authError } = signUp
              ? await authClient.signUp.email({ ...credentials, name: String(fields.get("name")) })
              : await authClient.signIn.email(credentials);
            if (authError) throw new Error(authError.message ?? "Could not sign you in.");
            setRevision((value) => value + 1);
          } catch (reason) {
            setError((reason as Error).message);
          } finally {
            setBusy(false);
          }
        }}
        className="staff-invite-auth"
      >
        {signUp && (
          <label>
            Your name
            <input name="name" required maxLength={100} autoComplete="name" />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={signUp ? "new-password" : "current-password"}
          />
        </label>
        <button className="workspace-primary" disabled={busy}>
          {busy ? "Please wait…" : signUp ? "Create account" : "Sign in"}
        </button>
        <button type="button" disabled={busy} onClick={() => setSignUp(!signUp)}>
          {signUp ? "Already have an account? Sign in" : "New to Nomidat? Create an account"}
        </button>
      </form>
    );
  }
  function renderInvitationState() {
    if (joined)
      return (
        <>
          <p>Your access is ready.</p>
          <Link className="workspace-primary" to="/">
            Open workspace
          </Link>
        </>
      );
    if (loading) return null;
    if (!signedIn)
      return (
        <>
          <p>
            Use the email address your invitation was sent to. Accepting an email invitation
            requires a verified account.
          </p>
          {renderSignIn()}
        </>
      );
    return renderSignedInInvitation();
  }
  function renderSignedInInvitation() {
    return (
      <>
        <p>Signed in as {email}</p>
        {!verified && (
          <div className="staff-role-guide">
            <p>
              Email invitations require a verified email address. This account is not verified yet.
            </p>
            <p>The owner can add you directly using your account ID:</p>
            <code className="staff-account-id">{accountId}</code>
            <p>After the owner adds you, open your workspace.</p>
            <Link to="/">Open workspace</Link>
          </div>
        )}
        {invitation && (
          <>
            <h2>{invitation.organizationName ?? "Business invitation"}</h2>
            <p>
              Invited as <strong>{invitation.role}</strong>
            </p>
            <p>{staffRoles.find((item) => item.value === invitation.role)?.description}</p>
            {invitation.status === "pending" && new Date(invitation.expiresAt) > new Date() ? (
              <button
                className="workspace-primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const result = await createApiRequest<{
                      member?: { organizationId: string };
                    }>(`/invitations/${invitationId}/accept`, { method: "POST", body: "{}" });
                    if (result.member?.organizationId)
                      sessionStorage.setItem("nomidat.organization", result.member.organizationId);
                    setJoined(true);
                  } catch (reason) {
                    setError((reason as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Joining…" : "Accept invitation"}
              </button>
            ) : (
              <p>
                This invitation is {invitation.status === "pending" ? "expired" : invitation.status}
                . Ask the owner for a new invitation if needed.
              </p>
            )}
          </>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await clearSession();
              loaded.setData({ user: undefined, invitation: undefined });
              setRevision((value) => value + 1);
            } catch (reason) {
              setError((reason as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Use a different account
        </button>
      </>
    );
  }
  return (
    <main className="invitation-page">
      <Link to="/" className="workspace-brand">
        <span>n</span>nomidat.
      </Link>
      <section className="workspace-card workspace-form">
        <h1>{joined ? "You’re part of the team" : "Join your business team"}</h1>
        {loading && <p role="status">Checking your invitation…</p>}
        {error && (
          <p className="workspace-error" role="alert">
            {error}
          </p>
        )}
        {renderInvitationState()}
      </section>
    </main>
  );
}
