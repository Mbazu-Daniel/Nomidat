import { useState } from "react";
import { StaffPermissions } from "./staff-permissions";
import { staffRoles } from "./staff-roles";
import type { StaffInviteFormProps } from "./types/staff.type";
export function StaffInviteForm({ path, busy, mutate, onCancel }: StaffInviteFormProps) {
  const [mode, setMode] = useState("userId");
  const [role, setRole] = useState("staff");
  return (
    <form
      className="staff-add-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const email = String(data.get("email") ?? "").trim();
        const userId = String(data.get("userId") ?? "").trim();
        const ok = await mutate(
          path + (mode === "email" ? "/invitations" : "/members"),
          "POST",
          mode === "email" ? { email, role: role.split(",") } : { userId, role: role.split(",") },
          mode === "email"
            ? "Invitation created. You can copy its link below. Email delivery requires configured email settings."
            : "Staff member added.",
        );
        if (ok) {
          form.reset();
          onCancel();
        }
      }}
    >
      <div className="staff-form-grid">
        <label>
          Add by
          <select value={mode} disabled={busy} onChange={(event) => setMode(event.target.value)}>
            <option value="email">Email invitation</option>
            <option value="userId">Existing account ID</option>
          </select>
        </label>
        {mode === "email" ? (
          <label>
            Email address
            <input
              name="email"
              type="email"
              required
              disabled={busy}
              placeholder="staff@example.com"
            />
          </label>
        ) : (
          <label>
            Account ID
            <input
              name="userId"
              required
              disabled={busy}
              pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
              placeholder="Paste their account ID"
            />
          </label>
        )}
        <label>
          Role
          <select
            value={role.split(",")[0]}
            disabled={busy}
            onChange={(event) => setRole(event.target.value)}
          >
            {staffRoles.map((item) => (
              <option value={item.value} key={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {role.startsWith("staff") && (
        <StaffPermissions value={role} onChange={setRole} disabled={busy} />
      )}
      <p className="staff-role-description">
        {staffRoles.find((item) => item.value === role)?.description}
      </p>
      <div className="workspace-actions">
        <button type="button" disabled={busy} onClick={() => onCancel()}>
          Cancel
        </button>
        <button className="workspace-primary" disabled={busy}>
          {busy ? "Saving…" : mode === "email" ? "Create invitation" : "Add staff member"}
        </button>
      </div>
    </form>
  );
}
