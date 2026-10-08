import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, gte, isNotNull, isNull, or } from "@nomidat/db";
import { announcement, notification, outboundWebhook } from "@nomidat/db/schema";
import { WEBHOOK_EVENTS, type WebhookEvent } from "./engagement.constants";
import { assertSafeWebhookUrl, generateWebhookSecret } from "./webhook-signing";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";

@Injectable()
export class EngagementService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  /** Published announcements, newest first, excluding ones that have expired. */
  async getAnnouncements(organizationId: string) {
    const now = new Date();
    return this.db
      .select({
        id: announcement.id,
        title: announcement.title,
        body: announcement.body,
        severity: announcement.severity,
        publishedAt: announcement.publishedAt,
        expiresAt: announcement.expiresAt,
      })
      .from(announcement)
      .where(
        and(
          eq(announcement.organizationId, organizationId),
          // publishedAt is set when it goes live, so a null one is still a draft.
          isNotNull(announcement.publishedAt),
          // An announcement that has passed its expiry is hidden.
          or(isNull(announcement.expiresAt), gte(announcement.expiresAt, now)),
        ),
      )
      .orderBy(desc(announcement.publishedAt));
  }

  async getNotifications(userId: string, organizationId: string) {
    return this.db
      .select({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        kind: notification.kind,
        entityType: notification.entityType,
        entityId: notification.entityId,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      })
      .from(notification)
      .where(and(eq(notification.userId, userId), eq(notification.organizationId, organizationId)))
      .orderBy(desc(notification.createdAt))
      .limit(50);
  }

  async markRead(userId: string, organizationId: string, notificationId: string) {
    const [row] = await this.db
      .update(notification)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notification.id, notificationId),
          // Scoped to the caller so one member cannot mark another's as read.
          eq(notification.userId, userId),
          eq(notification.organizationId, organizationId),
        ),
      )
      .returning({ id: notification.id });
    if (!row) throw new NotFoundException("Notification not found.");
    return row;
  }

  /**
   * Creates a notification. The unique index on (userId, dedupeKey) makes a retry
   * a no-op rather than a duplicate, so callers can fire this freely.
   */
  async notify(
    organizationId: string,
    userId: string,
    entry: {
      title: string;
      body?: string;
      kind?: string;
      entityType?: string;
      entityId?: string;
      dedupeKey?: string;
    },
  ) {
    const [created] = await this.db
      .insert(notification)
      .values({
        organizationId,
        userId,
        title: entry.title,
        body: entry.body ?? null,
        kind: entry.kind ?? "info",
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        dedupeKey: entry.dedupeKey ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: notification.id });
    return created ?? null;
  }

  /**
   * The same notice for everyone the caller has decided should see it — an
   * owner list, a role. Each member gets their own row, so marking one read
   * never marks it read for the rest.
   */
  async notifyOwners(
    organizationId: string,
    userIds: readonly string[],
    entry: Parameters<EngagementService["notify"]>[2],
  ) {
    const created = await Promise.all(
      userIds.map((userId) => this.notify(organizationId, userId, entry)),
    );
    return created.filter((row) => row !== null);
  }

  /**
   * Subscribes an endpoint. The URL is validated here, once, at configuration
   * time — and the dispatcher never follows redirects so that check cannot be
   * undone later.
   */
  async createWebhook(organizationId: string, input: { url: string; events: string[] }) {
    const url = assertSafeWebhookUrl(input.url);
    const events: WebhookEvent[] = input.events.filter((value): value is WebhookEvent =>
      (WEBHOOK_EVENTS as readonly string[]).includes(value),
    );

    if (events.length === 0) {
      throw new NotFoundException("Choose at least one supported event.");
    }

    const secret = generateWebhookSecret();
    const [created] = await this.db
      .insert(outboundWebhook)
      .values({
        organizationId,
        url: url.toString(),
        events: events.join(","),
        secret,
      })
      .returning({
        id: outboundWebhook.id,
        url: outboundWebhook.url,
        events: outboundWebhook.events,
        status: outboundWebhook.status,
      });

    // Returned here and never again. Without it a subscriber cannot sign the
    // deliveries they are being sent, so the subscription would be unusable.
    return { ...created, secret };
  }

  /** Never returns the secret: it is shown once, at creation, and never again. */
  async getWebhooks(organizationId: string) {
    return this.db
      .select({
        id: outboundWebhook.id,
        url: outboundWebhook.url,
        events: outboundWebhook.events,
        status: outboundWebhook.status,
        lastDeliveryAt: outboundWebhook.lastDeliveryAt,
        lastStatusCode: outboundWebhook.lastStatusCode,
        consecutiveFailures: outboundWebhook.consecutiveFailures,
        createdAt: outboundWebhook.createdAt,
      })
      .from(outboundWebhook)
      .where(eq(outboundWebhook.organizationId, organizationId))
      .orderBy(desc(outboundWebhook.createdAt));
  }

  async deleteWebhook(organizationId: string, id: string) {
    const [row] = await this.db
      .delete(outboundWebhook)
      .where(and(eq(outboundWebhook.id, id), eq(outboundWebhook.organizationId, organizationId)))
      .returning({ id: outboundWebhook.id });
    if (!row) throw new NotFoundException("Webhook not found.");
    return row;
  }
}
