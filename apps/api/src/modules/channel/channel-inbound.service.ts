import { HttpException, Injectable, Logger } from "@nestjs/common";
import { ChannelService } from "./channel.service";
import { ConversationalService } from "../conversational/conversational.service";
import { ChannelProvider } from "./types";
import type { ChannelAdapter, InboundMessage, OutboundMessage } from "./types";

const UNLINKED_HINT =
  "This chat is not linked yet. Open Nomidat → Channels, generate a code, then send it here (Telegram: /start CODE).";

@Injectable()
export class ChannelInboundService {
  constructor(
    private readonly channelService: ChannelService,
    private readonly conversationalService: ConversationalService,
  ) {}

  async createInboundReply(
    message: InboundMessage,
    adapter: ChannelAdapter,
  ): Promise<{ organizationId: string | null }> {
    try {
      const resolved = await this.channelService.getOrCreateOrganizationForInbound(message);

      if (!resolved) {
        await adapter.createOutboundMessage(this.createTextOutbound(message, UNLINKED_HINT));
        return { organizationId: null };
      }

      if (resolved.linked) {
        await adapter.createOutboundMessage(
          this.createTextOutbound(
            message,
            "Linked. Send text, a voice note, or a picture captioned expense, sale, invoice or inventory. I’ll show the extracted details here and ask you to confirm before saving.",
          ),
        );
        return { organizationId: resolved.identity.organizationId };
      }

      const reply = await this.conversationalService.processInbound(
        message,
        resolved.identity.organizationId,
        resolved.identity.id,
        adapter,
      );
      await adapter.createOutboundMessage(this.createTextOutbound(message, reply));

      return { organizationId: resolved.identity.organizationId };
    } catch (error) {
      new Logger("ChannelInbound").error({
        event: "inbound_processing_failed",
        provider: message.provider,
        error: error instanceof Error ? error.name : "UnknownError",
      });
      const text =
        error instanceof HttpException && error.getStatus() < 500
          ? error.message
          : "Could not process that message. Please try again later.";
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
