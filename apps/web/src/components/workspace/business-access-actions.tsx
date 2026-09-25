import { useState } from "react";
import { createApiRequest } from "@/lib/api";
export function BusinessAccessActions({
  organizationId,
  owner,
}: {
  organizationId: string;
  owner: boolean;
}) {
  const [action, setAction] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="workspace-card settings-section">
      <h2>Business access</h2>
      <p>
        Leaving removes your access. Deleting a business permanently removes its records for
        everyone.
      </p>
      {error && (
        <p role="alert" className="workspace-error">
          {error}
        </p>
      )}
      {!action ? (
        <div className="workspace-actions">
          <button className="workspace-secondary" onClick={() => setAction("leave")}>
            Leave business
          </button>
          {owner && (
            <button className="workspace-secondary" onClick={() => setAction("delete")}>
              Delete business
            </button>
          )}
        </div>
      ) : (
        <form
          className="workspace-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (confirmation !== (action === "delete" ? "DELETE" : "LEAVE")) return;
            setBusy(true);
            setError("");
            try {
              await createApiRequest(
                `/organizations/${organizationId}` + (action === "leave" ? "/leave" : ""),
                { method: action === "leave" ? "POST" : "DELETE" },
              );
              sessionStorage.removeItem("nomidat.organization");
              window.location.assign("/");
            } catch (reason) {
              setError((reason as Error).message);
              setBusy(false);
            }
          }}
        >
          <p>
            {action === "delete"
              ? "This cannot be undone. All business data will be deleted."
              : "You will need to be added again to regain access. A sole owner cannot leave without another owner."}
          </p>
          <label>
            Type {action === "delete" ? "DELETE" : "LEAVE"} to confirm
            <input
              value={confirmation}
              disabled={busy}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="workspace-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setAction("");
                setConfirmation("");
              }}
            >
              Cancel
            </button>
            <button
              className="workspace-primary"
              disabled={busy || confirmation !== (action === "delete" ? "DELETE" : "LEAVE")}
            >
              {busy
                ? "Working…"
                : action === "delete"
                  ? "Permanently delete business"
                  : "Confirm leave"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
