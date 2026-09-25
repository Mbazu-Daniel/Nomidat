// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { api, render, change, click, button, submit } from "./render";
import { ChatPanel } from "../chat-panel";
import { PictureImport } from "../picture-import";
import { ChannelsPanel } from "../channels-panel";
const message = {
  id: "message",
  role: "assistant",
  content: "Record fuel expense? Reply CONFIRM token",
  toolName: "pending_confirmation",
};
describe("chat and picture safeguards", () => {
  it("requires an explicit click to confirm a proposed action", async () => {
    api.mockResolvedValue([message]);
    const ui = await render(ChatPanel, { organizationId: "shop", canWrite: true });
    expect(api.mock.calls.every((call) => !call[1])).toBe(true);
    expect(ui.textContent).not.toContain("Reply CONFIRM");
    await click(button(ui, "Confirm action"));
    expect(api).toHaveBeenCalledWith("/organizations/shop/chat/confirmation", {
      method: "POST",
      body: '{"messageId":"message","confirm":true}',
    });
  });
  it("sends typed text and keeps it after a failed request", async () => {
    api.mockResolvedValue([]);
    const ui = await render(ChatPanel, { organizationId: "shop", canWrite: false });
    expect(ui.querySelector('[aria-label="Attach picture"]')).toBeNull();
    await change(ui.querySelector("textarea"), "What is in stock?");
    api.mockRejectedValueOnce(new Error("Offline"));
    await submit(ui.querySelector("form"));
    expect(ui.textContent).toContain("Offline");
    expect(ui.querySelector("textarea")?.value).toBe("What is in stock?");
    expect(api).toHaveBeenLastCalledWith("/organizations/shop/chat", {
      method: "POST",
      body: '{"text":"What is in stock?"}',
    });
  });
  it("falls back to typing when voice recording is unavailable", async () => {
    api.mockResolvedValue([]);
    const ui = await render(ChatPanel, { organizationId: "shop", canWrite: true });
    await click(ui.querySelector('[aria-label="Record voice note"]'));
    expect(ui.textContent).toContain("Voice recording is unavailable");
  });
  it("reviews extracted expense details without recording until the user saves", async () => {
    api.mockImplementation(async (path) =>
      path.endsWith("/picture-import")
        ? {
            expense: {
              description: "Fuel",
              amountNaira: 200,
              date: "2026-09-24",
              paymentMethod: "cash",
              category: null,
            },
            warnings: ["Check amount"],
          }
        : [],
    );
    const ui = await render(PictureImport, {
      organizationId: "shop",
      section: "expenses",
      onSaved: vi.fn(),
      onCancel: vi.fn(),
      initialFile: new File(["image"], "receipt.png", { type: "image/png" }),
    });
    await click(button(ui, "Read picture"));
    expect(ui.textContent).toContain("Check amount");
    expect(ui.querySelector<HTMLInputElement>('[name="amount"]')?.value).toBe("200");
    expect(api.mock.calls.some(([path]) => path.endsWith("/expenses"))).toBe(false);
  });
  it("rejects an empty photo extraction instead of showing an empty save form", async () => {
    api.mockResolvedValue({ items: [], warnings: [] });
    const ui = await render(PictureImport, {
      organizationId: "shop",
      section: "inventory",
      onSaved: vi.fn(),
      onCancel: vi.fn(),
      initialFile: new File(["image"], "stock.png", { type: "image/png" }),
    });
    await click(button(ui, "Read picture"));
    expect(ui.textContent).toContain("No items could be read");
    expect(button(ui, "Save record")).toBeNull();
  });
  it("asks for confirmation before disconnecting a chat account", async () => {
    api.mockResolvedValue([
      {
        id: "chat",
        provider: "telegram",
        externalId: "123",
        displayName: "Ada",
        lastInboundAt: null,
      },
    ]);
    const ui = await render(ChannelsPanel, { organizationId: "shop", canWrite: true });
    await click(button(ui, "Disconnect"));
    expect(api.mock.calls.every((call) => !call[1])).toBe(true);
    await click(button(ui, "Disconnect"));
    expect(api).toHaveBeenCalledWith("/organizations/shop/channels/identities/chat", {
      method: "DELETE",
    });
    expect(ui.textContent).not.toContain("Ada");
  });
  it("does not expose account disconnection to read-only staff", async () => {
    api.mockResolvedValue([
      { id: "chat", provider: "whatsapp", externalId: "123", lastInboundAt: null },
    ]);
    const ui = await render(ChannelsPanel, { organizationId: "shop", canWrite: false });
    expect(button(ui, "Disconnect")).toBeNull();
    expect(ui.textContent).toContain("123");
  });
  it("puts a voice transcript in the composer for review without sending it", async () => {
    class Recorder {
      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable = (_event: { data: Blob }) => {};
      onstop = () => {};
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable({ data: new Blob(["audio"], { type: this.mimeType }) });
        this.onstop();
      }
    }
    const stop = vi.fn();
    vi.stubGlobal("MediaRecorder", Recorder);
    vi.stubGlobal(
      "navigator",
      Object.assign(Object.create(navigator), {
        mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) },
      }),
    );
    api.mockImplementation(async (path) =>
      path.endsWith("/voice") ? { text: "Sold rice for 500" } : [],
    );
    const ui = await render(ChatPanel, { organizationId: "shop", canWrite: true });
    await click(ui.querySelector('[aria-label="Record voice note"]'));
    await click(ui.querySelector('[aria-label="Stop recording"]'));
    expect(ui.querySelector("textarea")?.value).toBe("Sold rice for 500");
    expect(stop).toHaveBeenCalled();
    expect(
      api.mock.calls.filter(([, init]) => init?.method === "POST").map(([path]) => path),
    ).toEqual(["/organizations/shop/chat/voice"]);
  });
  it("shows an expiring link code without sending a chat message", async () => {
    api.mockImplementation(async (path) =>
      path.endsWith("/link-codes") ? { code: "TESTCODE", expiresAt: "2099-01-01" } : [],
    );
    const ui = await render(ChannelsPanel, { organizationId: "shop", canWrite: true });
    await click(button(ui, "Connect Telegram"));
    expect(ui.textContent).toContain("/start TESTCODE");
    expect(api).toHaveBeenCalledWith("/organizations/shop/channels/link-codes", { method: "POST" });
  });
});
