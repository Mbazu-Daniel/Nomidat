import { useEffect, useState } from "react";
import { createApiRequest } from "@/lib/api";
import type { StaffInvitation } from "./types/staff.type";
export function InvitationInbox({ verified }: { verified: boolean }) {
  const [rows, setRows] = useState<StaffInvitation[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    if (!verified) {
      setLoading(false);
      return;
    }
    void createApiRequest<StaffInvitation[]>("/invitations")
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [verified]);
  async function respond(id: string, action: string) {
    setBusy(true);
    setError("");
    try {
      const result = await createApiRequest<{ member?: { organizationId: string } }>(
        `/invitations/${id}/${action}`,
        { method: "POST", body: "{}" },
      );
      if (action === "accept") {
        if (result.member?.organizationId)
          sessionStorage.setItem("nomidat.organization", result.member.organizationId);
        window.location.assign("/");
      } else setRows((previous) => previous.filter((row) => row.id !== id));
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const pending = rows.filter(
    (row) => row.status === "pending" && new Date(row.expiresAt) > new Date(),
  );
  return (
    <section className="workspace-card settings-section">
      <h2>Your invitations</h2>
      {!verified ? (
        <p>
          A verified email is required to view or accept email invitations. A business owner can
          instead add you using your account ID above.
        </p>
      ) : (
        <>
          {loading && <p>Loading invitations…</p>}
          {error && (
            <p role="alert" className="workspace-error">
              {error}
            </p>
          )}
          {!loading && !error && !pending.length && <p>No pending invitations.</p>}
          {pending.map((row) => (
            <div className="staff-member-row" key={row.id}>
              <div>
                <strong>{row.organizationName ?? row.email}</strong>
                <p>
                  {row.role} · Expires {new Date(row.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <div className="workspace-actions">
                <button
                  className="workspace-primary"
                  disabled={busy}
                  onClick={() => void respond(row.id, "accept")}
                >
                  Accept
                </button>
                <button disabled={busy} onClick={() => void respond(row.id, "reject")}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
