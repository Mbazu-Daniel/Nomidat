import { readChannelMedia } from "../channel/read-media";
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
export class WhatsAppClient implements ChannelAdapter {
  readonly provider = ChannelProvider.WhatsApp;

  constructor(@Inject(API_ENV) private readonly env: ApiEnv) {}

  async createOutboundMessage(message: OutboundMessage): Promise<void> {
    if (message.kind === "template") {
      await this.createTemplateMessage(message);
      return;
    }

    if (message.kind === "document" && message.documentUrl) {
      await this.createWhatsAppApiCall({
        messaging_product: "whatsapp",
        to: message.externalId,
        type: "document",
        document: {
          link: message.documentUrl,
          filename: message.documentFilename,
          caption: message.text,
        },
      });
      return;
    }

    await this.createWhatsAppApiCall({
      messaging_product: "whatsapp",
      to: message.externalId,
      type: "text",
      text: { body: message.text ?? "" },
    });
  }

  async getInboundMedia(mediaId: string): Promise<{ data: Uint8Array; mimeType?: string }> {
    const headers = { Authorization: `Bearer ${this.getAccessToken()}` };
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(mediaId)}`,
      { headers, signal: AbortSignal.timeout(15_000) },
    );
    if (!response.ok)
      throw new ServiceUnavailableException("WhatsApp media could not be resolved.");
    const media = (await response.json()) as { url?: string; mime_type?: string };
    if (!media.url) throw new ServiceUnavailableException("WhatsApp returned no media URL.");
    const url = new URL(media.url);
    if (
      url.protocol !== "https:" ||
      ![".fbsbx.com", ".fbcdn.net"].some((host) => url.hostname.endsWith(host))
    )
      throw new ServiceUnavailableException("Invalid WhatsApp media URL.");
    const download = await fetch(url, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    if (!download.ok || Number(download.headers.get("content-length")) > 10 * 1024 * 1024)
      throw new ServiceUnavailableException("WhatsApp media download failed or is too large.");
    return { data: await readChannelMedia(download), mimeType: media.mime_type };
  }

  private async createTemplateMessage(message: OutboundMessage): Promise<void> {
    const templateName = message.templateName ?? this.env.WHATSAPP_TEMPLATE_NAME;
    if (!templateName) {
      throw new ForbiddenException(
        "Outside WhatsApp 24h session window and WHATSAPP_TEMPLATE_NAME is unset",
      );
    }
    await this.createWhatsAppApiCall({
      messaging_product: "whatsapp",
      to: message.externalId,
      type: "template",
      template: {
        name: templateName,
        language: { code: message.templateLanguage ?? "en" },
      },
    });
  }

  private getAccessToken(): string {
    const token = this.env.WHATSAPP_ACCESS_TOKEN;
    if (!token) {
      throw new ServiceUnavailableException("WHATSAPP_ACCESS_TOKEN is not configured");
    }
    return token;
  }

  private getPhoneNumberId(): string {
    const id = this.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!id) {
      throw new ServiceUnavailableException("WHATSAPP_PHONE_NUMBER_ID is not configured");
    }
    return id;
  }

  private async createWhatsAppApiCall(body: Record<string, unknown>): Promise<void> {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${this.getPhoneNumberId()}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.getAccessToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) {
      throw new ServiceUnavailableException(`WhatsApp send failed: ${await response.text()}`);
    }
  }
}
