import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, isNull } from "@nomidat/db";
import { channelIdentity, channelLinkCode } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import {
  createChannelLinkCodeValue,
  getChannelLinkCodeExpiresAt,
  getIsWithinWhatsAppSessionWindow,
  getLinkCodeFromText,
} from "./channel-crypto";
import type { ChannelProvider } from "./types";
import type { InboundMessage } from "./types";

@Injectable()
export class ChannelService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  async getOrganizationChannelIdentities(organizationId: string) {
    return this.db.db
      .select()
      .from(channelIdentity)
      .where(eq(channelIdentity.organizationId, organizationId));
  }

  async getChannelIdentityByExternalId(provider: ChannelProvider, externalId: string) {
    const rows = await this.db.db
      .select()
      .from(channelIdentity)
      .where(
        and(eq(channelIdentity.provider, provider), eq(channelIdentity.externalId, externalId)),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async createOrganizationChannelLinkCode(organizationId: string, createdByUserId: string) {
    const code = createChannelLinkCodeValue();
    const expiresAt = getChannelLinkCodeExpiresAt();
    const [row] = await this.db.db
      .insert(channelLinkCode)
      .values({
        organizationId,
        code,
        createdByUserId,
        expiresAt,
      })
      .returning();
    return row;
  }

  async deleteOrganizationChannelIdentity(organizationId: string, channelIdentityId: string) {
    const deleted = await this.db.db
      .delete(channelIdentity)
      .where(
        and(
          eq(channelIdentity.id, channelIdentityId),
          eq(channelIdentity.organizationId, organizationId),
        ),
      )
      .returning({ id: channelIdentity.id });

    if (deleted.length === 0) {
      throw new NotFoundException("Channel identity not found");
    }
  }

  async updateChannelLastInboundAt(channelIdentityId: string, at = new Date()) {
    await this.db.db
      .update(channelIdentity)
      .set({ lastInboundAt: at, updatedAt: at })
      .where(eq(channelIdentity.id, channelIdentityId));
  }

  getIsWithinSessionWindow(lastInboundAt: Date | null | undefined): boolean {
    return getIsWithinWhatsAppSessionWindow(lastInboundAt);
  }

  /**
   * Resolve org for an inbound message: existing identity, or OTC linking.
   * Returns null when the sender is unknown and the text is not a valid link code.
   */
  async getOrCreateOrganizationForInbound(message: InboundMessage) {
    const existing = await this.getChannelIdentityByExternalId(
      message.provider,
      message.externalId,
    );
    if (existing) {
      await this.updateChannelLastInboundAt(existing.id, message.receivedAt);
      return { identity: existing, linked: false as const };
    }

    const code = getLinkCodeFromText(message.text);
    if (!code) {
      return null;
    }

    const identity = await this.createChannelIdentityFromLinkCode({
      code,
      provider: message.provider,
      externalId: message.externalId,
      displayName: message.displayName,
      receivedAt: message.receivedAt,
    });

    return { identity, linked: true as const };
  }

  private async createChannelIdentityFromLinkCode(input: {
    code: string;
    provider: ChannelProvider;
    externalId: string;
    displayName?: string;
    receivedAt: Date;
  }) {
    return this.db.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(channelLinkCode)
        .where(and(eq(channelLinkCode.code, input.code), isNull(channelLinkCode.usedAt)))
        .limit(1);

      const link = rows[0];
      if (!link) {
        throw new BadRequestException("Invalid or already used link code");
      }
      if (link.expiresAt.getTime() < Date.now()) {
        throw new BadRequestException("Link code expired");
      }

      const prior = await tx
        .select()
        .from(channelIdentity)
        .where(
          and(
            eq(channelIdentity.provider, input.provider),
            eq(channelIdentity.externalId, input.externalId),
          ),
        )
        .limit(1);

      if (prior[0]) {
        throw new ConflictException("Channel already linked");
      }

      const now = input.receivedAt;
      const [identity] = await tx
        .insert(channelIdentity)
        .values({
          organizationId: link.organizationId,
          provider: input.provider,
          externalId: input.externalId,
          displayName: input.displayName,
          lastInboundAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await tx.update(channelLinkCode).set({ usedAt: now }).where(eq(channelLinkCode.id, link.id));

      return identity;
    });
  }
}
