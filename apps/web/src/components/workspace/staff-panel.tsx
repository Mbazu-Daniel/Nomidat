import { StaffInviteForm } from "./staff-invite-form";
import { StaffRoleGuide } from "./staff-role-guide";
import { PhoneStaff } from "./phone-staff";
import { useEffect, useState } from "react";
import { IconUsers, IconPlus } from "@tabler/icons-react";
import { createApiRequest } from "@/lib/api";
import { StaffMemberRow } from "./staff-member-row";
import type { StaffAccess, StaffInvitation, StaffMember } from "./types/staff.type";
export function StaffPanel({ organizationId }: { organizationId: string }) {
  const path = `/organizations/${organizationId}`;
  const [access, setAccess] = useState<StaffAccess>();
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [invitations, setInvitations] = useState<StaffInvitation[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);
  const [revision, setRevision] = useState(0);
  const canManage = access?.role.split(",").some((value) => ["owner", "admin"].includes(value));
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void (async () => {
      const { current, people, pending } = await loadStaff(path, page);
      if (cancelled) return;
      setAccess(current);
      setMembers(people.members);
      setTotal(people.total);
      setInvitations(pending);
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
  }, [path, page, revision]);
  async function mutate(url: string, method: string, body: unknown, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await createApiRequest(url, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
      setNotice(message);
      setRevision((value) => value + 1);
      return true;
    } catch (reason) {
      setError((reason as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function renderPendingInvitations() {
    if (!canManage) return null;
    const pending = invitations.filter(
      (item) => item.status === "pending" && new Date(item.expiresAt) > new Date(),
    );
    if (!pending.length) return null;
    return (
      <div className="staff-invitations">
        <h3>Pending invitations</h3>
        {pending.map((item) => (
          <div className="staff-member-row" key={item.id}>
            <div>
              <strong>{item.email}</strong>
              <p>
                {item.role} · Expires {new Date(item.expiresAt).toLocaleDateString()}
              </p>
            </div>
            <div className="staff-member-actions">
              <button
                disabled={busy}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `${window.location.origin}/accept-invitation/${item.id}`,
                    );
                    setNotice(
                      "Invitation link copied. The recipient must sign in with the invited email address.",
                    );
                  } catch {
                    setError("Could not copy the link. Check clipboard permissions and try again.");
                  }
                }}
              >
                Copy invite link
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void mutate(`/invitations/${item.id}/cancel`, "POST", {}, "Invitation cancelled.")
                }
              >
                Cancel invitation
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }
  function renderMembers() {
    return (
      <>
        {access &&
          members.map((member) => (
            <StaffMemberRow
              key={`${member.id}-${member.role}`}
              member={member}
              access={access}
              busy={busy}
              onChange={(id, nextRole) =>
                void mutate(
                  `${path}/members/${id}`,
                  "PATCH",
                  { role: nextRole.split(",") },
                  "Role updated.",
                )
              }
              onRemove={(id) =>
                void mutate(`${path}/members/${id}`, "DELETE", undefined, "Access removed.")
              }
            />
          ))}
        {!members.length && !error && <p>No staff members to show.</p>}
        {total > 20 && (
          <div className="workspace-actions">
            <button disabled={page === 0 || busy} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>Page {page + 1}</span>
            <button disabled={(page + 1) * 20 >= total || busy} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        )}
      </>
    );
  }
  return (
    <section className="workspace-card staff-panel">
      <header className="staff-heading">
        <div>
          <h2>
            <IconUsers size={22} /> Staff & permissions
          </h2>
          <p>Choose who can access this business and what their role allows.</p>
        </div>
        {canManage && (
          <button
            className="workspace-primary"
            type="button"
            disabled={busy}
            onClick={() => setAdding(!adding)}
          >
            <IconPlus size={17} /> Add staff
          </button>
        )}
      </header>
      {error && (
        <p role="alert" className="workspace-error">
          {error}{" "}
          <button type="button" onClick={() => setRevision((value) => value + 1)}>
            Retry
          </button>
        </p>
      )}
      {notice && (
        <p role="status" className="staff-notice">
          {notice}
        </p>
      )}
      {canManage && <PhoneStaff organizationId={organizationId} />}
      {adding && canManage && (
        <StaffInviteForm
          path={path}
          busy={busy}
          mutate={mutate}
          onCancel={() => setAdding(false)}
        />
      )}
      <p className="staff-role-description">
        Add an existing account by ID, or invite a verified email account. Email delivery requires
        configured email settings; you can also copy the invitation link.
      </p>
      <StaffRoleGuide />
      {loading ? <p role="status">Loading staff…</p> : renderMembers()}
      {renderPendingInvitations()}
      {access && (
        <p className="staff-account-id">
          Your account ID: <code>{access.userId}</code>
        </p>
      )}
    </section>
  );
}

async function loadStaff(path: string, page: number) {
  const current = await createApiRequest<StaffAccess>(path + "/access");
  const manager = current.role.split(",").some((value) => ["owner", "admin"].includes(value));
  const [people, pending] = await Promise.all([
    createApiRequest<{ members: StaffMember[]; total: number }>(
      `${path}/members?limit=20&offset=${page * 20}`,
    ),
    manager ? createApiRequest<StaffInvitation[]>(path + "/invitations") : Promise.resolve([]),
  ]);
  return { current, people, pending };
}
