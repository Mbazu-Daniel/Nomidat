import { Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "@nomidat/db";
import { channelIdentity, member, paymentLink } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { TelegramClient } from "../telegram/telegram.client";
import { WhatsAppClient } from "../whatsapp/whatsapp.client";
import { ChannelProvider } from "../channel/types";

@Injectable()
export class PaymentNotificationService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly telegram: TelegramClient,
    private readonly whatsapp: WhatsAppClient,
  ) {}

  async createNotification(reference: string) {
    await this.db.transaction(async (tx) => {
      const [link] = await tx
        .select()
        .from(paymentLink)
        .where(eq(paymentLink.reference, reference))
        .for("update")
        .limit(1);
      if (!link || link.status !== "paid" || link.notifiedAt) return;
      const owners = await tx
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
      for (const owner of owners) {
        const text = `Payment received: NGN ${(link.amountKobo / 100).toLocaleString("en-NG")} for sale ${link.orderId}. Reference ${reference}.`;
        if (owner.provider === "telegram")
          await this.telegram.createOutboundMessage({
            provider: ChannelProvider.Telegram,
            externalId: owner.externalId,
            kind: "text",
            text,
          });
        if (owner.provider === "whatsapp")
          await this.whatsapp.createOutboundMessage({
            provider: ChannelProvider.WhatsApp,
            externalId: owner.externalId,
            kind:
              owner.lastInboundAt && Date.now() - owner.lastInboundAt.getTime() < 86_400_000
                ? "text"
                : "template",
            text,
          });
      }
      await tx
        .update(paymentLink)
        .set({ notifiedAt: new Date() })
        .where(eq(paymentLink.id, link.id));
    });
  }
}
