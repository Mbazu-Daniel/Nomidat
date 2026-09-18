import { describe, expect, it } from "vitest";
import {
  createChannelLinkCodeValue,
  getChannelLinkCodeExpiresAt,
  getIsWithinWhatsAppSessionWindow,
  getLinkCodeFromText,
} from "../channel-crypto";

describe("getLinkCodeFromText", () => {
  it("returns null for missing input", () => {
    expect(getLinkCodeFromText(undefined)).toBeNull();
    expect(getLinkCodeFromText("")).toBeNull();
    expect(getLinkCodeFromText("   ")).toBeNull();
  });

  it("extracts the code from a Telegram /start payload", () => {
    expect(getLinkCodeFromText("/start ABC123XY")).toBe("ABC123XY");
    expect(getLinkCodeFromText("/START abc123xy")).toBe("ABC123XY");
  });

  it("returns null for a bare /start without payload", () => {
    expect(getLinkCodeFromText("/start")).toBeNull();
  });

  it("accepts a bare 8-char hex code", () => {
    expect(getLinkCodeFromText("abcdef12")).toBe("ABCDEF12");
  });

  it("rejects non-code text", () => {
    expect(getLinkCodeFromText("hello there")).toBeNull();
    expect(getLinkCodeFromText("ABC1234")).toBeNull();
    expect(getLinkCodeFromText("ABC123456")).toBeNull();
    expect(getLinkCodeFromText("ZZZZZZZZ")).toBeNull();
  });
});

describe("getIsWithinWhatsAppSessionWindow", () => {
  it("returns false without a previous inbound timestamp", () => {
    expect(getIsWithinWhatsAppSessionWindow(null)).toBe(false);
    expect(getIsWithinWhatsAppSessionWindow(undefined)).toBe(false);
  });

  it("returns true inside the 24h window, inclusive of the boundary", () => {
    const now = new Date("2026-09-18T12:00:00Z");
    expect(getIsWithinWhatsAppSessionWindow(new Date("2026-09-18T11:00:00Z"), now)).toBe(true);
    expect(getIsWithinWhatsAppSessionWindow(new Date("2026-09-17T12:00:00Z"), now)).toBe(true);
  });

  it("returns false outside the window", () => {
    const now = new Date("2026-09-18T12:00:00Z");
    expect(getIsWithinWhatsAppSessionWindow(new Date("2026-09-17T11:59:59Z"), now)).toBe(false);
  });
});

describe("createChannelLinkCodeValue", () => {
  it("creates an 8-char uppercase hex code", () => {
    expect(createChannelLinkCodeValue()).toMatch(/^[A-F0-9]{8}$/);
  });

  it("creates unique codes", () => {
    const codes = new Set(Array.from({ length: 20 }, () => createChannelLinkCodeValue()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("getChannelLinkCodeExpiresAt", () => {
  it("expires 15 minutes after the given time", () => {
    const now = new Date("2026-09-18T12:00:00Z");
    expect(getChannelLinkCodeExpiresAt(now).toISOString()).toBe("2026-09-18T12:15:00.000Z");
  });
});
