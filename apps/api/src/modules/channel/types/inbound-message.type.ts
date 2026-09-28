import type { ChannelProvider } from "./channel-provider.enum";

export type InboundMessageKind = "text" | "image" | "voice" | "document" | "unknown";

export type InboundMessage = {
  provider: ChannelProvider;
  externalId: string;
  displayName?: string;
  kind: InboundMessageKind;
  text?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  rawUpdateId?: string;
  receivedAt: Date;
};
