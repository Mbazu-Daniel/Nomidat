import { randomBytes } from "node:crypto";

const LINK_CODE_BYTES = 4;
const LINK_CODE_TTL_MS = 15 * 60 * 1000;
const WHATSAPP_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

export function createChannelLinkCodeValue(): string {
  return randomBytes(LINK_CODE_BYTES).toString("hex").toUpperCase();
}

export function getChannelLinkCodeExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + LINK_CODE_TTL_MS);
}

export function getIsWithinWhatsAppSessionWindow(
  lastInboundAt: Date | null | undefined,
  now = new Date(),
): boolean {
  if (!lastInboundAt) return false;
  return now.getTime() - lastInboundAt.getTime() <= WHATSAPP_SESSION_WINDOW_MS;
}

/** Extract OTC from `/start CODE` (Telegram) or bare 8-char code (WhatsApp). */
export function getLinkCodeFromText(text: string | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  const startMatch = /^\/start(?:\s+(\S+))?$/i.exec(trimmed);
  if (startMatch) {
    const payload = startMatch[1];
    return payload ? payload.toUpperCase() : null;
  }
  if (/^[A-F0-9]{8}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return null;
}
