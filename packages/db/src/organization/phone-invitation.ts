import { pgTable, text, index } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { createInvitationColumns } from "./invitation-columns";
export const phoneInvitation = pgTable(
  "phone_invitation",
  {
    ...createOrgScopedColumns(),
    phoneNumber: text("phone_number").notNull(),
    ...createInvitationColumns(),
  },
  (t) => [
    index("phone_invitation_org_idx").on(t.organizationId),
    index("phone_invitation_phone_idx").on(t.phoneNumber),
  ],
);
