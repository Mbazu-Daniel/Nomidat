import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { API_ENV } from "../../common/config/env.module";
import type { ApiEnv } from "../../common/config/env";
import type { ChannelAdapter, OutboundMessage } from "../channel/types";
import { ChannelProvider } from "../channel/types";

@Injectable()
export class TelegramClient implements ChannelAdapter {
  readonly provider = ChannelProvider.Telegram;

  constructor(@Inject(API_ENV) private readonly env: ApiEnv) {}

  async createOutboundMessage(message: OutboundMessage): Promise<void> {
    if (message.kind === "template") {
      throw new ForbiddenException("Telegram does not use template messages");
    }
    if (message.kind === "document" && message.documentUrl) {
      await this.createTelegramApiCall("sendDocument", {
        chat_id: message.externalId,
        document: message.documentUrl,
        caption: message.text,
        filename: message.documentFilename,
      });
      return;
    }
    await this.createTelegramApiCall("sendMessage", {
      chat_id: message.externalId,
      text: message.text ?? "",
    });
  }

  getIsValidWebhookSecret(secretHeader: string | undefined): boolean {
    const expected = this.env.TELEGRAM_WEBHOOK_SECRET;
    if (!expected) return true;
    return secretHeader === expected;
  }

  private getToken(): string {
    const token = this.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new ServiceUnavailableException("TELEGRAM_BOT_TOKEN is not configured");
    }
    return token;
  }

  private async createTelegramApiCall(
    method: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const response = await fetch(`https://api.telegram.org/bot${this.getToken()}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new ServiceUnavailableException(`Telegram API ${method} failed: ${text}`);
    }
    return response.json();
  }
}
