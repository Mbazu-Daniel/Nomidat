import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { TelegramController } from "../../telegram/telegram.controller";
import { WhatsAppController } from "../../whatsapp/whatsapp.controller";
import { readChannelMedia } from "../read-media";
import type { TelegramClient } from "../../telegram/telegram.client";
import type { WhatsAppClient } from "../../whatsapp/whatsapp.client";
import type { ChannelInboundService } from "../channel-inbound.service";
import type { ApiEnv } from "../../../common/config/env";
import type { Request } from "express";

describe("native channel pictures", () => {
  it("routes Telegram camera photos using the largest version and preserves the caption", async () => {
    const receive = vi.fn();
    const client = { getIsValidWebhookSecret: () => true } as unknown as TelegramClient;
    const controller = new TelegramController(client, {
      createInboundReply: receive,
    } as unknown as ChannelInboundService);
    await controller.createTelegramWebhook(
      {
        update_id: 1,
        message: {
          message_id: 2,
          chat: { id: 3, type: "private" },
          caption: "expense",
          photo: [
            { file_id: "small", width: 50, height: 50 },
            { file_id: "large", width: 1000, height: 1000 },
          ],
        },
      },
      "test",
    );
    expect(receive).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "image",
        mediaUrl: "large",
        text: "expense",
        mediaMimeType: "image/jpeg",
        rawUpdateId: "1",
      }),
      client,
    );
  });
  it("routes signed WhatsApp camera images with caption and media ID", async () => {
    const receive = vi.fn();
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: "123",
                    id: "picture-id",
                    timestamp: "1790294400",
                    type: "image",
                    image: { id: "media-id", mime_type: "image/jpeg", caption: "sale" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = "sha256=" + createHmac("sha256", "test-secret").update(rawBody).digest("hex");
    const client = {} as WhatsAppClient;
    const controller = new WhatsAppController(
      { WHATSAPP_APP_SECRET: "test-secret" } as ApiEnv,
      client,
      { createInboundReply: receive } as unknown as ChannelInboundService,
    );
    await controller.createWhatsAppWebhook(
      { body: payload, rawBody } as Request & { rawBody: Buffer },
      signature,
    );
    expect(receive).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "image",
        mediaUrl: "media-id",
        text: "sale",
        rawUpdateId: "picture-id",
      }),
      client,
    );
    await expect(
      controller.createWhatsAppWebhook(
        { body: payload, rawBody } as Request & { rawBody: Buffer },
        "bad",
      ),
    ).rejects.toThrow();
    expect(receive).toHaveBeenCalledTimes(1);
  });
  it("limits downloads even without a content-length header", async () => {
    const cancel = vi.fn();
    const response = new Response(
      new ReadableStream({
        pull(controller) {
          controller.enqueue(new Uint8Array(6 * 1024 * 1024));
        },
        cancel,
      }),
    );
    await expect(readChannelMedia(response)).rejects.toThrow("exceeds 10 MB");
    expect(cancel).toHaveBeenCalled();
  });
});
