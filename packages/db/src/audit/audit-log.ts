import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { user } from "../auth/user";

/**
 * An append-only record of who did what.
 *
 * There are no update or delete paths in the service that writes this: an audit
 * trail that can be edited is not an audit trail. Rows are also written for
 * actions that ultimately did not change state, because "someone tried and was
 * refused" is exactly the thing being reviewed.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    ...createOrgScopedColumns(),
    /** Null when the actor was anonymous, e.g. a public share link. */
    actorUserId: uuid("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    actorEmail: text("actor_email"),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    /** The record the action was taken on, e.g. "invoice" or "sale". */
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    /**
     * What changed. Never store credentials, tokens or full request bodies here —
     * this is read by anyone who can read the organization's audit page.
     */
    metadata: jsonb("metadata"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_organization_id_created_at_idx").on(t.organizationId, t.createdAt),
    index("audit_log_organization_id_entity_idx").on(t.organizationId, t.entityType, t.entityId),
    index("audit_log_actor_user_id_idx").on(t.actorUserId),
  ],
);
