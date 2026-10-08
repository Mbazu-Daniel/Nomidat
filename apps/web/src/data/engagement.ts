import { createApiRequest } from "@/lib/api";

const base = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;

/* ---------------------------------------------------------- audit trail */

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

interface AuditPage {
  entries: AuditEntry[];
  total: number;
}

export function getAuditLog(organizationId: string, offset = 0, limit = 50) {
  return createApiRequest<AuditPage>(
    `${base(organizationId)}/audit-log?limit=${limit}&offset=${offset}`,
  );
}

interface AuditSummaryRow {
  action: string;
  value: number;
}

export function getAuditSummary(organizationId: string) {
  return createApiRequest<AuditSummaryRow[]>(`${base(organizationId)}/audit-log/summary`);
}

/* -------------------------------------------------- announcements & inbox */

export interface Announcement {
  id: string;
  title: string;
  body: string | null;
  severity: string;
  publishedAt: string;
  expiresAt: string | null;
}

export interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export function getAnnouncements(organizationId: string) {
  return createApiRequest<Announcement[]>(`${base(organizationId)}/announcements`);
}

export function getNotifications(organizationId: string) {
  return createApiRequest<NotificationRow[]>(`${base(organizationId)}/notifications`);
}

export function markNotificationRead(organizationId: string, notificationId: string) {
  return createApiRequest<{ id: string }>(
    `${base(organizationId)}/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "PATCH" },
  );
}

/* ------------------------------------------------------ outbound webhooks */

export interface WebhookRow {
  id: string;
  url: string;
  events: string;
  status: string;
  lastDeliveryAt: string | null;
  lastStatusCode: number | null;
  consecutiveFailures: number;
  createdAt: string;
}

interface CreatedWebhook extends WebhookRow {
  /** Shown once, at creation, and never returned again. */
  secret: string;
}

export function getWebhooks(organizationId: string) {
  return createApiRequest<WebhookRow[]>(`${base(organizationId)}/webhooks`);
}

export function createWebhook(organizationId: string, input: { url: string; events: string[] }) {
  return createApiRequest<CreatedWebhook>(`${base(organizationId)}/webhooks`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteWebhook(organizationId: string, webhookId: string) {
  return createApiRequest<{ id: string }>(
    `${base(organizationId)}/webhooks/${encodeURIComponent(webhookId)}`,
    { method: "DELETE" },
  );
}
