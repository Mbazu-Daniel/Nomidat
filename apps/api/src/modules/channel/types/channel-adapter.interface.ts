import type { OutboundMessage } from "./outbound-message.type";
import type { ChannelProvider } from "./channel-provider.enum";

/** Real seam: Telegram + WhatsApp adapters share this contract. */
export interface ChannelAdapter {
  readonly provider: ChannelProvider;
  createOutboundMessage(message: OutboundMessage): Promise<void>;
  getInboundMedia?(mediaUrl: string): Promise<{ data: Uint8Array; mimeType?: string }>;
}
