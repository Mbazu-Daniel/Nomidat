import { useEffect, useState } from "react";
import { createApiRequest } from "@/lib/api";
import type { PhoneInvitation } from "./types/staff.type";
export function PhoneInbox() {
  const [rows, setRows] = useState<PhoneInvitation[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void createApiRequest<PhoneInvitation[]>("/phone-invitations")
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
  }, []);
  async function respond(id: string, action: string) {
    setBusy(true);
    setError("");
    try {
      const result = await createApiRequest<{ organizationId: string }>(
        `/phone-invitations/${id}/${action}`,
        { method: "POST", body: "{}" },
      );
      if (action === "accept") {
        sessionStorage.setItem("nomidat.organization", result.organizationId);
        window.location.assign("/");
      } else setRows((items) => items.filter((item) => item.id !== id));
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="workspace-card settings-section">
      <h2>Phone invitations</h2>
      {error && (
        <p role="alert" className="workspace-error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading invitations…</p>
      ) : (
        !rows.length && <p>No pending phone invitations.</p>
      )}
      {rows.map((row) => (
        <div className="staff-member-row" key={row.id}>
          <div>
            <strong>{row.organizationName}</strong>
            <p>{row.role.replaceAll("_writer", " editing").replaceAll(",", " · ")}</p>
          </div>
          <div className="workspace-actions">
            <button
              className="workspace-primary"
              disabled={busy}
              onClick={() => void respond(row.id, "accept")}
            >
              Join business
            </button>
            <button disabled={busy} onClick={() => void respond(row.id, "reject")}>
              Decline
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
