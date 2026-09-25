import type { StaffPermissionsProps } from "./types/staff.type";
const permissionAreas = [
  ["inventory", "Inventory"],
  ["sales", "Sales & payments"],
  ["expenses", "Expenses"],
  ["invoices", "Invoices"],
  ["customers", "Contacts"],
  ["channels", "Connected channels"],
] as const;
export function StaffPermissions({ value, onChange, disabled }: StaffPermissionsProps) {
  const roles = value.split(",");
  return (
    <fieldset className="staff-custom-permissions" disabled={disabled}>
      <legend>Allow changes to</legend>
      <p>
        All staff can view business records and reports. Select where this person can add, edit or
        remove records.
      </p>
      {permissionAreas.map(([area, label]) => (
        <label key={area}>
          <input
            type="checkbox"
            checked={roles.includes(area + "_writer")}
            onChange={(event) => {
              const next = roles.filter((role) => role !== area + "_writer");
              if (event.target.checked) next.push(area + "_writer");
              onChange(next.join(","));
            }}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
export function canWriteArea(role: string, area: string) {
  return role
    .split(",")
    .some(
      (item) =>
        ["owner", "admin", "manager", area + "_writer"].includes(item) ||
        (area === "chat" && permissionAreas.some(([key]) => item === key + "_writer")),
    );
}
