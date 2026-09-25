export const staffRoles = [
  {
    value: "staff",
    label: "Staff",
    description:
      "View business records and reports. Optional permissions allow changes in selected areas.",
  },
  {
    value: "manager",
    label: "Manager",
    description:
      "View and change business records, including sales, stock, expenses and invoices. Cannot manage staff or payment keys.",
  },
  {
    value: "admin",
    label: "Admin",
    description: "Manage business records, staff and payment settings.",
  },
  { value: "member", label: "Member", description: "View-only access, the same as Staff." },
] as const;
