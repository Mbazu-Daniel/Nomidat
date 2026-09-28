import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

export const businessAccess = createAccessControl({
  ...defaultStatements,
  business: ["read", "write", "managePayments"] as const,
});
export const businessRoles = {
  inventory_writer: businessAccess.newRole({ ...memberAc.statements, business: ["read"] }),
  sales_writer: businessAccess.newRole({ ...memberAc.statements, business: ["read"] }),
  expenses_writer: businessAccess.newRole({ ...memberAc.statements, business: ["read"] }),
  invoices_writer: businessAccess.newRole({ ...memberAc.statements, business: ["read"] }),
  customers_writer: businessAccess.newRole({ ...memberAc.statements, business: ["read"] }),
  channels_writer: businessAccess.newRole({ ...memberAc.statements, business: ["read"] }),

  owner: businessAccess.newRole({
    ...ownerAc.statements,
    business: ["read", "write", "managePayments"],
  }),
  admin: businessAccess.newRole({
    ...adminAc.statements,
    business: ["read", "write", "managePayments"],
  }),
  manager: businessAccess.newRole({ ...memberAc.statements, business: ["read", "write"] }),
  staff: businessAccess.newRole({ ...memberAc.statements, business: ["read"] }),
  member: businessAccess.newRole({ ...memberAc.statements, business: ["read"] }),
};

export const assignableRoles = Object.keys(businessRoles);
