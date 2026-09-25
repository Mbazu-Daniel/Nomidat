import { index, pgTable, text } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { createInvitationColumns } from "./invitation-columns";

export const invitation = pgTable(
  "invitation",
  {
    ...createOrgScopedColumns(),
    email: text("email").notNull(),
    ...createInvitationColumns(),
  },
  (t) => [
    index("invitation_organization_id_idx").on(t.organizationId),
    index("invitation_email_idx").on(t.email),
  ],
);
