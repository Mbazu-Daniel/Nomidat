import { useEffect, useState } from "react";
import { createApiRequest } from "@/lib/api";
import { StaffPermissions } from "./staff-permissions";
import type { PhoneInvitation } from "./types/staff.type";
export function PhoneStaff({ organizationId }: { organizationId: string }) {
  const path = `/organizations/${organizationId}/phone-invitations`;
  const [rows, setRows] = useState<PhoneInvitation[]>([]);
  const [role, setRole] = useState("staff");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let cancelled = false;
    void createApiRequest<PhoneInvitation[]>(path)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, [path, revision]);
  return (
    <details className="staff-role-guide">
      <summary>Invite staff by phone number</summary>
      <form
        className="workspace-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          setBusy(true);
          setError("");
          setNotice("");
          try {
            await createApiRequest(path, {
              method: "POST",
              body: JSON.stringify({
                phoneNumber: String(new FormData(form).get("phoneNumber")).trim(),
                roles: role.split(","),
              }),
            });
            setNotice(
              "Invitation created. Copy the sign-in link below and share it with your staff member. They must verify the invited phone number.",
            );
            setRevision((n) => n + 1);
            form.reset();
          } catch (reason) {
            setError((reason as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Phone number
          <input
            name="phoneNumber"
            type="tel"
            placeholder="+2348012345678"
            pattern="\+[1-9][0-9]{7,14}"
            required
            disabled={busy}
          />
          <small>Include country code. No email or existing account is needed.</small>
        </label>
        <StaffPermissions value={role} onChange={setRole} disabled={busy} />
        <div className="workspace-actions">
          <button className="workspace-primary" disabled={busy}>
            Create phone invitation
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" className="workspace-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {rows.map((row) => (
        <div className="staff-member-row" key={row.id}>
          <div>
            <strong>{row.phoneNumber}</strong>
            <p>Expires {new Date(row.expiresAt).toLocaleDateString()}</p>
          </div>
          <div className="workspace-actions">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.origin + "/login");
                  setNotice(
                    "Sign-in link copied. Ask them to sign in using the invited phone number.",
                  );
                } catch {
                  setError("Could not copy the link.");
                }
              }}
            >
              Copy sign-in link
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await createApiRequest(path + "/" + row.id + "/cancel", {
                    method: "POST",
                    body: "{}",
                  });
                  setRevision((n) => n + 1);
                } catch (reason) {
                  setError((reason as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Cancel invitation
            </button>
          </div>
        </div>
      ))}
    </details>
  );
}
