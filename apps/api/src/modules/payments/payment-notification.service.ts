import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, sql } from "@nomidat/db";
import { channelIdentity, member, organization, paymentLink } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { minorAmountPlain } from "../../common/helpers/money-format";
import { TelegramClient } from "../telegram/telegram.client";
import { WhatsAppClient } from "../whatsapp/whatsapp.client";
import { ChannelProvider } from "../channel/types";
import { EngagementService } from "../engagement/engagement.service";
import { WebhookDispatchService } from "../engagement/webhook-dispatch.service";

/**
 * The one place a payment link turns into "money arrived".
 *
 * It announces that fact three times over: to the owners' Telegram or WhatsApp,
 * to their in-app inbox, and to every webhook subscription that asked for
 * `payment.received`. All three read the same row under the same lock, so a
 * replayed callback announces nothing twice — `notifiedAt` is the latch.
 */
@Injectable()
export class PaymentNotificationService {
  private readonly logger = new Logger(PaymentNotificationService.name);

  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly telegram: TelegramClient,
    private readonly whatsapp: WhatsAppClient,
    private readonly engagement: EngagementService,
    private readonly webhooks: WebhookDispatchService,
  ) {}

  async createNotification(reference: string) {
    const received = await this.db.transaction(async (tx) => {
      const [link] = await tx
        .select()
        .from(paymentLink)
        .where(eq(paymentLink.reference, reference))
        .for("update")
        .limit(1);
      if (!link || link.status !== "paid" || link.notifiedAt) return null;

      // Owners are read from `member` rather than from their channel identities,
      // so an owner who never linked Telegram still gets the in-app notice.
      const owners = await tx
        .select({ userId: member.userId })
        .from(member)
        .where(
          and(
            eq(member.organizationId, link.organizationId),
            sql`${member.role} ~ '(^|,)owner(,|$)'`,
          ),
        );
      const [orgRow] = await tx
        .select({ currency: organization.currency })
        .from(organization)
        .where(eq(organization.id, link.organizationId))
        .limit(1);

      const channels = await tx
        .select({
          externalId: channelIdentity.externalId,
          provider: channelIdentity.provider,
          lastInboundAt: channelIdentity.lastInboundAt,
        })
        .from(channelIdentity)
        .innerJoin(
          member,
          and(
            eq(member.userId, channelIdentity.userId),
            eq(member.organizationId, channelIdentity.organizationId),
          ),
        )
        .where(
          and(
            eq(channelIdentity.organizationId, link.organizationId),
            sql`${member.role} ~ '(^|,)owner(,|$)'`,
          ),
        );

      // The message names the currency the payment was actually taken in. A fixed
      // "NGN" would tell a seller in another currency what they were paid in words
      // that disagree with the number beside them.
      const currency = orgRow?.currency ?? "NGN";
      for (const channel of channels) {
        const text = `Payment received: ${currency} ${minorAmountPlain(link.amountMinor, currency)} for sale ${link.orderId}. Reference ${reference}.`;
        if (channel.provider === "telegram")
          await this.telegram.createOutboundMessage({
            provider: ChannelProvider.Telegram,
            externalId: channel.externalId,
            kind: "text",
            text,
          });
        if (channel.provider === "whatsapp")
          await this.whatsapp.createOutboundMessage({
            provider: ChannelProvider.WhatsApp,
            externalId: channel.externalId,
            kind:
              channel.lastInboundAt && Date.now() - channel.lastInboundAt.getTime() < 86_400_000
                ? "text"
                : "template",
            text,
          });
      }

      await tx
        .update(paymentLink)
        .set({ notifiedAt: new Date() })
        .where(eq(paymentLink.id, link.id));

      return {
        organizationId: link.organizationId,
        ownerIds: owners.map((owner) => owner.userId),
        orderId: link.orderId,
        currency,
        amountMinor: link.amountMinor,
      };
    });

    // Nothing left the latch closed: already announced, or not a paid link.
    if (!received) return;

    const data = {
      paymentLinkReference: reference,
      orderId: received.orderId,
      currency: received.currency,
      amountMinor: received.amountMinor,
    };

    // Post-commit and out loud. A receiver being down must not roll back the
    // fact that money arrived, and the inbox must not be told about a latch that
    // a retried callback is about to reopen.
    const announced = [
      this.engagement
        .notifyOwners(received.organizationId, received.ownerIds, {
          title: "Payment received",
          body: `${received.currency} ${minorAmountPlain(received.amountMinor, received.currency)} for sale ${received.orderId}.`,
          kind: "payment",
          entityType: "order",
          entityId: received.orderId ?? reference,
          dedupeKey: `payment:${reference}`,
        })
        .catch((reason: unknown) =>
          this.logger.warn(`payment inbox notice not written: ${String(reason)}`),
        ),
      this.webhooks
        .dispatch(received.organizationId, "payment.received", data)
        .catch((reason: unknown) =>
          this.logger.warn(`payment.received webhook not sent: ${String(reason)}`),
        ),
    ];
    await Promise.all(announced);
  }
}
