import { UseGuards } from "@nestjs/common";
import { InboundRateLimitGuard } from "../../common/rate-limit/inbound-rate-limit.guard";
import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { API_ENV } from "../../common/config/env.module";
import type { ApiEnv } from "../../common/config/env";
import { ChannelInboundService } from "../channel/channel-inbound.service";
import { ChannelProvider } from "../channel/types";
import type { InboundMessage } from "../channel/types";
import { WhatsAppClient } from "./whatsapp.client";
import { getIsValidWhatsAppSignature } from "./whatsapp-signature";
import type { WhatsAppWebhookMessage, WhatsAppWebhookPayload } from "./types";

type RequestWithRawBody = Request & { rawBody?: Buffer };

@ApiExcludeController()
@Controller("channels/whatsapp")
@UseGuards(InboundRateLimitGuard)
export class WhatsAppController {
  constructor(
    @Inject(API_ENV) private readonly env: ApiEnv,
    private readonly whatsAppClient: WhatsAppClient,
    private readonly channelInboundService: ChannelInboundService,
  ) {}

  @Get("webhook")
  getWhatsAppWebhookChallenge(
    @Query("hub.mode") mode: string | undefined,
    @Query("hub.verify_token") verifyToken: string | undefined,
    @Query("hub.challenge") challenge: string | undefined,
    @Res() res: Response,
  ) {
    if (
      mode === "subscribe" &&
      verifyToken &&
      this.env.WHATSAPP_VERIFY_TOKEN &&
      verifyToken === this.env.WHATSAPP_VERIFY_TOKEN
    ) {
      return res.status(200).send(challenge ?? "");
    }
    throw new UnauthorizedException("WhatsApp verify token mismatch");
  }

  @Post("webhook")
  @HttpCode(200)
  async createWhatsAppWebhook(
    @Req() req: RequestWithRawBody,
    @Headers("x-hub-signature-256") signature: string | undefined,
  ) {
    const appSecret = this.env.WHATSAPP_APP_SECRET;
    if (!appSecret)
      throw new UnauthorizedException("WhatsApp webhook verification is not configured.");
    {
      const rawBody = req.rawBody;
      if (!rawBody || !getIsValidWhatsAppSignature(rawBody, signature, appSecret)) {
        throw new UnauthorizedException("Invalid WhatsApp signature");
      }
    }

    const payload = req.body as WhatsAppWebhookPayload;
    for (const inbound of this.getInboundMessages(payload)) {
      await this.channelInboundService.createInboundReply(inbound, this.whatsAppClient);
    }
    return { ok: true };
  }

  private getInboundMessages(payload: WhatsAppWebhookPayload): InboundMessage[] {
    const messages: InboundMessage[] = [];
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value?.messages?.length) continue;
        const contactName = value.contacts?.[0]?.profile?.name;
        for (const message of value.messages) {
          messages.push(this.getInboundMessage(message, contactName));
        }
      }
    }
    return messages;
  }

  private getInboundMessage(message: WhatsAppWebhookMessage, contactName?: string): InboundMessage {
    const base = {
      provider: ChannelProvider.WhatsApp,
      externalId: message.from,
      displayName: contactName,
      rawUpdateId: message.id,
      receivedAt: new Date(Number(message.timestamp) * 1000),
    };

    if (message.type === "text" && message.text?.body) {
      return { ...base, kind: "text" as const, text: message.text.body };
    }
    if (message.type === "image" && message.image)
      return {
        ...base,
        kind: "image" as const,
        text: message.image.caption,
        mediaUrl: message.image.id,
        mediaMimeType: message.image.mime_type,
      };
    if (message.type === "audio" && message.audio) {
      return {
        ...base,
        kind: "voice" as const,
        mediaUrl: message.audio.id,
        mediaMimeType: message.audio.mime_type,
      };
    }
    if (message.type === "document" && message.document) {
      return {
        ...base,
        kind: message.document.mime_type?.startsWith("image/")
          ? ("image" as const)
          : ("document" as const),
        text: message.document.caption,
        mediaUrl: message.document.id,
        mediaMimeType: message.document.mime_type,
      };
    }
    return { ...base, kind: "unknown" as const };
  }
}
