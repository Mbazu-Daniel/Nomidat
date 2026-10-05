import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq } from "@nomidat/db";
import { outboundWebhook } from "@nomidat/db/schema";
import {
  MAX_CONSECUTIVE_FAILURES,
  WEBHOOK_EVENTS,
  WEBHOOK_TIMEOUT_MS,
  type WebhookEvent,
} from "./engagement.constants";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { signWebhookPayload } from "./webhook-signing";

  /**
   * Fire-and-forget: a sale must not fail because a tenant's receiver is down.
   * Failures are counted on the subscription, which pauses it after enough.
   */
@Injectable()
export class WebhookDispatchService {
  private readonly logger = new Logger(WebhookDispatchService.name);

  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  /** Queues an event to every active subscription that asked for it. */
  async dispatch(organizationId: string, event: WebhookEvent, payload: Record<string, unknown>) {
    const subscriptions = await this.db
      .select({
        id: outboundWebhook.id,
        url: outboundWebhook.url,
        events: outboundWebhook.events,
        secret: outboundWebhook.secret,
      })
      .from(outboundWebhook)
      .where(
        and(
          eq(outboundWebhook.organizationId, organizationId),
          eq(outboundWebhook.status, "active"),
        ),
      );

    const matching = subscriptions.filter((row) => this.subscribesTo(row.events, event));
    if (matching.length === 0) return;

    const body = JSON.stringify({ event, organizationId, sentAt: new Date().toISOString(), data: payload });

    await Promise.all(
      matching.map((subscription) => this.deliver(subscription, body, event)),
    );
  }

  /**
   * Events are stored as a comma-separated list rather than a join table: the set
   * is small, fixed, and never queried across organizations.
   */
  private subscribesTo(events: string, event: WebhookEvent): boolean {
    return events
      .split(",")
      .map((value) => value.trim())
      .includes(event);
  }

  private async deliver(
    subscription: { id: string; url: string; secret: string },
    body: string,
    event: WebhookEvent,
  ) {
    const timestamp = Math.floor(Date.now() / 1000);
    try {
      const response = await fetch(subscription.url, {
        method: "POST",
        body,
        headers: {
          "Content-Type": "application/json",
          "X-Nomidat-Event": event,
          "X-Nomidat-Signature": signWebhookPayload(subscription.secret, body, timestamp),
        },
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
        // A redirect could point at an internal address after validation, so
        // following one would defeat the URL check entirely.
        redirect: "error",
      });

      await this.recordOutcome(subscription.id, response.status);
    } catch (error) {
      this.logger.warn({ subscriptionId: subscription.id, event, error: String(error) });
      await this.recordOutcome(subscription.id, null);
    }
  }

  private async recordOutcome(subscriptionId: string, statusCode: number | null) {
    const [row] = await this.db
      .select({ consecutiveFailures: outboundWebhook.consecutiveFailures })
      .from(outboundWebhook)
      .where(eq(outboundWebhook.id, subscriptionId))
      .limit(1);

    const previous = row?.consecutiveFailures ?? 0;
    const failed = statusCode === null || statusCode >= 400;
    const next = failed ? previous + 1 : 0;

    await this.db
      .update(outboundWebhook)
      .set({
        consecutiveFailures: next,
        lastStatusCode: statusCode,
        lastDeliveryAt: new Date(),
        // Pausing stops the retries without deleting the customer's configuration.
        status: next >= MAX_CONSECUTIVE_FAILURES ? "paused" : "active",
        updatedAt: new Date(),
      })
      .where(eq(outboundWebhook.id, subscriptionId));
  }

  /** Validates that a requested event list contains only known events. */
  static parseEvents(input: string[]): WebhookEvent[] {
    const known = new Set<string>(WEBHOOK_EVENTS);
    return input.filter((value): value is WebhookEvent => known.has(value));
  }
}
