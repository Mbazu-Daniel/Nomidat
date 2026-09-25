import { describe, it, expect, vi, afterEach } from "vitest";
import { createDbStub } from "../../../common/db/test/db.stub";
import { ChannelService } from "../channel.service";
import { ChannelProvider } from "../types";
import { WhatsAppClient } from "../../whatsapp/whatsapp.client";
import type { ApiEnv } from "../../../common/config/env";
const inbound = {
  provider: ChannelProvider.Telegram,
  externalId: "sender",
  kind: "text" as const,
  text: "/start ABCD1234",
  receivedAt: new Date(),
};
const link = {
  id: "code",
  organizationId: "shop",
  createdByUserId: "user",
  expiresAt: new Date(Date.now() + 60000),
};
afterEach(() => vi.unstubAllGlobals());
describe("channel access", () => {
  it("rejects an expired code before creating an identity", async () => {
    const { db, inserts } = createDbStub([[], [{ ...link, expiresAt: new Date(0) }]]);
    await expect(new ChannelService(db).getOrCreateOrganizationForInbound(inbound)).rejects.toThrow(
      "expired",
    );
    expect(inserts).not.toHaveBeenCalled();
  });
  it("requires the code creator to retain membership", async () => {
    const { db, inserts } = createDbStub([[], [link], [], []]);
    await expect(new ChannelService(db).getOrCreateOrganizationForInbound(inbound)).rejects.toThrow(
      "Membership no longer exists",
    );
    expect(inserts).not.toHaveBeenCalled();
  });
  it("links the channel to the code creator and consumes the one-time code", async () => {
    const { db, inserts, updates } = createDbStub(
      [[], [link], [], [{ id: "member" }]],
      [[{ id: "identity" }], []],
    );
    await expect(
      new ChannelService(db).getOrCreateOrganizationForInbound(inbound),
    ).resolves.toMatchObject({ linked: true, identity: { id: "identity" } });
    expect(inserts).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user", organizationId: "shop", externalId: "sender" }),
    );
    expect(updates).toHaveBeenCalledWith({ usedAt: inbound.receivedAt });
  });
  it("does not forward the WhatsApp credential to an untrusted media host", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ url: "https://attacker.test/file" })));
    vi.stubGlobal("fetch", fetch);
    const client = new WhatsAppClient({ WHATSAPP_ACCESS_TOKEN: "test-token" } as ApiEnv);
    await expect(client.getInboundMedia("media")).rejects.toThrow("Invalid WhatsApp media URL");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("downloads bounded media only from the validated WhatsApp CDN", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ url: "https://lookaside.fbsbx.com/file", mime_type: "image/png" }),
        ),
      )
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal("fetch", fetch);
    const client = new WhatsAppClient({ WHATSAPP_ACCESS_TOKEN: "test-token" } as ApiEnv);
    const media = await client.getInboundMedia("media");
    expect([...media.data]).toEqual([1, 2, 3]);
    expect(media.mimeType).toBe("image/png");
    expect(fetch.mock.calls[1][1].redirect).toBe("error");
  });
});
