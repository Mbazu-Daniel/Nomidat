import { staffRoles } from "./staff-roles";
export function StaffRoleGuide() {
  return (
    <details className="staff-role-guide">
      <summary>What each role can do</summary>
      {staffRoles.map((item) => (
        <p key={item.value}>
          <strong>{item.label}:</strong> {item.description}
        </p>
      ))}
      <p>
        <strong>Owner:</strong> Full business control. Ownership changes aren’t available here.
      </p>
      <p>
        Staff permissions control changes in each selected area across the website and connected
        chats.
      </p>
    </details>
  );
}
