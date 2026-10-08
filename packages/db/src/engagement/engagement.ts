import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { generateId } from "../id";

/**
 * A message from the business to its own staff, shown in the workspace.
 *
 * Org-scoped rather than global: a platform announcement is a different thing and
 * is not modelled here, because it must not be able to masquerade as one of these.
 */
export const announcement = pgTable(
  "announcement",
  {
    ...createOrgScopedColumns(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    /** "info" | "warning" | "critical" decides the styling, never the visibility. */
    severity: text("severity").notNull().default("info"),
    publishedAt: timestamp("published_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("announcement_organization_id_published_at_idx").on(t.organizationId, t.publishedAt),
  ],
);

/**
 * An in-app notification for one member. `dedupeKey` makes redelivery harmless:
 * the same event twice produces one row, so a retried job cannot spam someone.
 */
export const notification = pgTable(
  "notification",
  {
    id: uuid("id")
      .$defaultFn(() => generateId())
      .primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    kind: text("kind").notNull().default("info"),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    dedupeKey: text("dedupe_key"),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("notification_user_id_created_at_idx").on(t.userId, t.createdAt),
    index("notification_organization_id_idx").on(t.organizationId),
    // Scoped per recipient: the same event may legitimately notify two people.
    uniqueIndex("notification_user_id_dedupe_key_uidx")
      .on(t.userId, t.dedupeKey)
      .where(sql`${t.dedupeKey} is not null`),
  ],
);

/**
 * An organization's outbound webhook subscription. The secret is stored so a
 * receiver can verify our signature; it is never returned by any read route.
 */
export const outboundWebhook = pgTable(
  "outbound_webhook",
  {
    ...createOrgScopedColumns(),
    url: text("url").notNull(),
    /** Comma-separated event names this endpoint subscribes to. */
    events: text("events").notNull(),
    secret: text("secret").notNull(),
    status: text("status").notNull().default("active"),
    lastDeliveryAt: timestamp("last_delivery_at"),
    lastStatusCode: integer("last_status_code"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("outbound_webhook_organization_id_idx").on(t.organizationId)],
);
