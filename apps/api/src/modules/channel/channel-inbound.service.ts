import { Injectable } from "@nestjs/common";
import { ChannelService } from "./channel.service";
import { ChannelProvider } from "./types";
import type { ChannelAdapter, InboundMessage, OutboundMessage } from "./types";

const UNLINKED_HINT =
  "This chat is not linked yet. Open Nomidat → Channels, generate a code, then send it here (Telegram: /start CODE).";

@Injectable()
export class ChannelInboundService {
  constructor(private readonly channelService: ChannelService) {}

  async createInboundReply(
    message: InboundMessage,
    adapter: ChannelAdapter,
  ): Promise<{ organizationId: string | null }> {
    try {
      const resolved = await this.channelService.createOrGetOrganizationForInbound(message);

      if (!resolved) {
        await adapter.createOutboundMessage(this.createTextOutbound(message, UNLINKED_HINT));
        return { organizationId: null };
      }

      if (resolved.linked) {
        await adapter.createOutboundMessage(
          this.createTextOutbound(message, "Linked. You can message this business from here."),
        );
      }

      // ponytail: AI orchestrator not wired yet — ack only when already linked
      return { organizationId: resolved.identity.organizationId };
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "Could not process that message.";
      await adapter.createOutboundMessage(this.createTextOutbound(message, text));
      return { organizationId: null };
    }
  }

  createSessionAwareOutbound(
    message: Omit<OutboundMessage, "kind" | "templateName"> & { text: string },
    lastInboundAt: Date | null | undefined,
    templateName: string | undefined,
  ): OutboundMessage {
    if (
      message.provider === ChannelProvider.WhatsApp &&
      !this.channelService.getIsWithinSessionWindow(lastInboundAt)
    ) {
      if (!templateName) {
        throw new Error("WhatsApp session window closed and no template configured");
      }
      return {
        ...message,
        kind: "template",
        templateName,
        templateLanguage: "en",
      };
    }
    return { ...message, kind: "text" };
  }

  private createTextOutbound(message: InboundMessage, text: string): OutboundMessage {
    return {
      provider: message.provider,
      externalId: message.externalId,
      kind: "text",
      text,
    };
  }
}
