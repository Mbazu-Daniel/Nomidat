import type { ChannelProvider } from "./channel-provider.enum";

export type OutboundMessageKind = "text" | "document" | "template";

export type OutboundMessage = {
  provider: ChannelProvider;
  externalId: string;
  kind: OutboundMessageKind;
  text?: string;
  documentUrl?: string;
  documentFilename?: string;
  /** WhatsApp: required when outside the 24h customer-care window */
  templateName?: string;
  templateLanguage?: string;
};
