import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { createApiRequest } from "@/lib/api";
import type { StaffInvitation } from "./types/staff.type";
import { staffRoles } from "./staff-roles";

export function AcceptInvitation({ invitationId }: { invitationId: string }) {
  const [invitation, setInvitation] = useState<StaffInvitation>();
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [accountId, setAccountId] = useState("");
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [signUp, setSignUp] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [joined, setJoined] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void (async () => {
      const session = await createApiRequest<{
        user?: { id: string; email: string; emailVerified: boolean };
      } | null>("/auth/session");
      if (cancelled) return;
      setSignedIn(Boolean(session?.user));
      setEmail(session?.user?.email ?? "");
      setAccountId(session?.user?.id ?? "");
      setVerified(Boolean(session?.user?.emailVerified));
      if (session?.user?.emailVerified) {
        const result = await createApiRequest<StaffInvitation>(`/invitations/${invitationId}`);
        if (!cancelled) setInvitation(result);
      }
    })()
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [invitationId, revision]);
  function renderSignIn() {
    return (
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          setBusy(true);
          setError("");
          try {
            await createApiRequest(signUp ? "/auth/sign-up/email" : "/auth/sign-in/email", {
              method: "POST",
              body: JSON.stringify({
                email: String(fields.get("email")).trim(),
                password: fields.get("password"),
                ...(signUp ? { name: fields.get("name") } : {}),
              }),
            });
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
        {joined ? (
          <>
            <p>Your access is ready.</p>
            <Link className="workspace-primary" to="/">
              Open workspace
            </Link>
          </>
        ) : !loading && !signedIn ? (
          <>
            <p>
              Use the email address your invitation was sent to. Accepting an email invitation
              requires a verified account.
            </p>
            {renderSignIn()}
          </>
        ) : (
          !loading &&
          signedIn && (
            <>
              <p>Signed in as {email}</p>
              {!verified && (
                <div className="staff-role-guide">
                  <p>
                    Email invitations require a verified email address. This account is not verified
                    yet.
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
                  {invitation.status === "pending" &&
                  new Date(invitation.expiresAt) > new Date() ? (
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
                            sessionStorage.setItem(
                              "nomidat.organization",
                              result.member.organizationId,
                            );
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
                      This invitation is{" "}
                      {invitation.status === "pending" ? "expired" : invitation.status}. Ask the
                      owner for a new invitation if needed.
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
                    await createApiRequest("/auth/sign-out", { method: "POST", body: "{}" });
                    setInvitation(undefined);
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
          )
        )}
      </section>
    </main>
  );
}
