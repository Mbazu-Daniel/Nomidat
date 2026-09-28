import { PhoneInbox } from "./phone-inbox";
import { useEffect, useState } from "react";
import { createApiRequest } from "@/lib/api";
import { InvitationInbox } from "./invitation-inbox";
import type { AccountSession, LoginSession } from "./types/settings.type";
export function AccountPanel() {
  const [account, setAccount] = useState<AccountSession | null>();
  const [sessions, setSessions] = useState<LoginSession[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      createApiRequest<AccountSession | null>("/auth/session"),
      createApiRequest<LoginSession[]>("/auth/sessions"),
    ])
      .then(([data, rows]) => {
        if (!cancelled) {
          setAccount(data);
          setSessions(rows);
        }
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <>
      <section className="workspace-card settings-section account-settings">
        <h2>Your account</h2>
        {error && (
          <p role="alert" className="workspace-error">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {account && (
          <>
            <p>
              {account.user.phoneNumberVerified
                ? account.user.phoneNumber
                : account.user.name + " · " + account.user.email}
            </p>
            <p className="staff-account-id">
              Your account ID: <code>{account.user.id}</code>
            </p>
            <div className="workspace-actions">
              <button
                className="workspace-secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const result = await createApiRequest<{ url?: string }>("/auth/link-social", {
                      method: "POST",
                      body: JSON.stringify({
                        provider: "google",
                        callbackURL: `${window.location.origin}/settings`,
                      }),
                    });
                    if (result.url) {
                      const url = new URL(result.url);
                      if (url.protocol !== "https:") throw new Error("Invalid sign-in URL.");
                      window.location.assign(url.href);
                    } else setNotice("Google account linked.");
                  } catch (reason) {
                    setError((reason as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Link Google account
              </button>
              <button
                className="workspace-secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await createApiRequest("/auth/sign-out", { method: "POST", body: "{}" });
                    sessionStorage.removeItem("nomidat.organization");
                    window.location.assign("/login");
                  } catch (reason) {
                    setError((reason as Error).message);
                    setBusy(false);
                  }
                }}
              >
                Sign out
              </button>
            </div>
            <p>Google linking requires Google sign-in to be configured.</p>
            <details>
              <summary>Login sessions ({sessions.length})</summary>
              {sessions.map((row) => (
                <div className="settings-session" key={row.id}>
                  <strong>
                    {row.id === account.session.id ? "This session" : "Active session"}
                  </strong>
                  <p>{row.userAgent || "Unknown device"}</p>
                  <p>
                    {row.ipAddress || "Unknown IP"} · Started{" "}
                    {new Date(row.createdAt).toLocaleString()} · Expires{" "}
                    {new Date(row.expiresAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </details>
          </>
        )}
        {account === undefined && !error && <p>Loading your account…</p>}
      </section>
      {account?.user.phoneNumberVerified && <PhoneInbox />}
      {account && !account.user.email.endsWith("@phone.nomidat.invalid") && (
        <InvitationInbox verified={account.user.emailVerified} />
      )}
    </>
  );
}
