import { PhoneInbox } from "./phone-inbox";
import { useState } from "react";
import { useLoadedResource, useSubmit } from "@/lib/use-api-resource";
import { authClient } from "@/lib/api";
import { clearSession } from "@/lib/session";
import { InvitationInbox } from "./invitation-inbox";
import type { AccountSession, LoginSession } from "./types/settings.type";
export function AccountPanel() {
  const loaded = useLoadedResource(
    async () => {
      const [session, listed] = await Promise.all([
        authClient.getSession(),
        authClient.listSessions(),
      ]);
      // The typed client is the source; the local shapes only narrow fields
      // this panel reads, so a new Better Auth field cannot break the build.
      return {
        account: session.data as unknown as AccountSession | null,
        sessions: (listed.data ?? []) as unknown as LoginSession[],
      };
    },
    [],
    { account: null, sessions: [] as LoginSession[] },
  );
  const account = loaded.data.account;
  const sessions = loaded.data.sessions;
  // The load error and the write error are one message to the seller, so the write
  // seam owns it and a failed load is carried into the same place.
  const { busy, error: writeError, submit } = useSubmit();
  const [notice, setNotice] = useState("");
  const error = loaded.error || writeError;
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
                  await submit(async () => {
                    const { data, error: linkError } = await authClient.linkSocial({
                      provider: "google",
                      callbackURL: `${window.location.origin}/settings`,
                    });
                    if (linkError) throw new Error(linkError.message ?? "Could not link Google.");
                    const url = data?.url;
                    if (url) {
                      const target = new URL(url);
                      // Only ever follow an https redirect from the auth server.
                      if (target.protocol !== "https:") throw new Error("Invalid sign-in URL.");
                      window.location.assign(target.href);
                    } else setNotice("Google account linked.");
                  });
                }}
              >
                Link Google account
              </button>
              <button
                className="workspace-secondary"
                disabled={busy}
                onClick={async () => {
                  await submit(async () => {
                    // Goes through clearSession so the offline cache is purged
                    // too, rather than only the server cookie.
                    await clearSession();
                    sessionStorage.removeItem("nomidat.organization");
                    window.location.assign("/login");
                  });
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
