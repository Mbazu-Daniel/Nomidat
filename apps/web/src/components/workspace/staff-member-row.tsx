import { StaffPermissions } from "./staff-permissions";
import { useState } from "react";
import { staffRoles } from "./staff-roles";
import type { StaffMemberRowProps } from "./types/staff.type";

export function StaffMemberRow({ member, access, busy, onChange, onRemove }: StaffMemberRowProps) {
  const [role, setRole] = useState(member.role);
  const [removing, setRemoving] = useState(false);
  const self = member.userId === access.userId;
  const owner = member.role.split(",").includes("owner");
  const canManage = access.role.split(",").some((value) => ["owner", "admin"].includes(value));
  const editable = canManage && !self && !owner;
  return (
    <div className="staff-member-row">
      <div className="staff-person">
        <span className="staff-avatar">
          {(member.user.name || member.user.email).slice(0, 1).toUpperCase()}
        </span>
        <div>
          <strong>
            {member.user.name || "Team member"}
            {self && <small> (you)</small>}
          </strong>
          <p>{member.user.phoneNumber || member.user.email}</p>
        </div>
      </div>
      {editable ? (
        <div className="staff-member-actions">
          <select
            aria-label={`Role for ${member.user.name || member.user.email}`}
            value={role.split(",")[0]}
            disabled={busy}
            onChange={(event) => setRole(event.target.value)}
          >
            {!staffRoles.some((item) => item.value === member.role.split(",")[0]) && (
              <option value={member.role}>{member.role}</option>
            )}
            {staffRoles.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          {role.startsWith("staff") && (
            <StaffPermissions value={role} onChange={setRole} disabled={busy} />
          )}
          {role !== member.role && (
            <button
              type="button"
              className="workspace-primary"
              disabled={busy}
              onClick={() => onChange(member.id, role)}
            >
              Save role
            </button>
          )}
          {removing ? (
            <>
              <span>Remove access?</span>
              <button type="button" disabled={busy} onClick={() => onRemove(member.id)}>
                Yes, remove
              </button>
              <button type="button" disabled={busy} onClick={() => setRemoving(false)}>
                Keep
              </button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={() => setRemoving(true)}>
              Remove
            </button>
          )}
        </div>
      ) : (
        <span className="workspace-badge">{member.role}</span>
      )}
    </div>
  );
}
