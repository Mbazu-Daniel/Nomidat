import { Body, Controller, Headers, HttpCode, Post, UnauthorizedException } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { ChannelInboundService } from "../channel/channel-inbound.service";
import { ChannelProvider } from "../channel/types";
import type { InboundMessage } from "../channel/types";
import { TelegramClient } from "./telegram.client";
import type { TelegramUpdate } from "./types";

@ApiExcludeController()
@Controller("channels/telegram")
export class TelegramController {
  constructor(
    private readonly telegramClient: TelegramClient,
    private readonly channelInboundService: ChannelInboundService,
  ) {}

  @Post("webhook")
  @HttpCode(200)
  async createTelegramWebhook(
    @Body() body: TelegramUpdate,
    @Headers("x-telegram-bot-api-secret-token") secret?: string,
  ) {
    if (!this.telegramClient.getIsValidWebhookSecret(secret)) {
      throw new UnauthorizedException("Invalid Telegram webhook secret");
    }

    const inbound = this.getInboundMessage(body);
    if (!inbound) {
      return { ok: true };
    }

    await this.channelInboundService.createInboundReply(inbound, this.telegramClient);
    return { ok: true };
  }

  private getInboundMessage(update: TelegramUpdate): InboundMessage | null {
    const message = update.message;
    if (!message) return null;

    const displayName =
      message.chat.title ??
      message.from?.username ??
      message.from?.first_name ??
      message.chat.first_name;

    if (message.voice) {
      return {
        provider: ChannelProvider.Telegram,
        externalId: String(message.chat.id),
        displayName,
        kind: "voice",
        text: message.caption,
        mediaUrl: message.voice.file_id,
        mediaMimeType: message.voice.mime_type,
        rawUpdateId: String(update.update_id),
        receivedAt: new Date(),
      };
    }

    if (message.document) {
      return {
        provider: ChannelProvider.Telegram,
        externalId: String(message.chat.id),
        displayName,
        kind: "document",
        text: message.caption,
        mediaUrl: message.document.file_id,
        mediaMimeType: message.document.mime_type,
        rawUpdateId: String(update.update_id),
        receivedAt: new Date(),
      };
    }

    if (message.text) {
      return {
        provider: ChannelProvider.Telegram,
        externalId: String(message.chat.id),
        displayName,
        kind: "text",
        text: message.text,
        rawUpdateId: String(update.update_id),
        receivedAt: new Date(),
      };
    }

    return {
      provider: ChannelProvider.Telegram,
      externalId: String(message.chat.id),
      displayName,
      kind: "unknown",
      rawUpdateId: String(update.update_id),
      receivedAt: new Date(),
    };
  }
}
