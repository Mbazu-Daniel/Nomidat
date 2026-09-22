import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { and, desc, eq, ilike } from "@nomidat/db";
import {
  contact,
  conversation,
  expense,
  expenseCategory,
  order,
  orderItem,
  product,
  message,
} from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { API_ENV } from "../../common/config/env.module";
import type { ApiEnv } from "../../common/config/env";
import type { ChannelAdapter, InboundMessage } from "../channel/types";
import { SalesService } from "../sales/sales.service";

type Intent =
  | "create_contact"
  | "record_sale"
  | "record_expense"
  | "check_balance"
  | "check_inventory"
  | "summary"
  | "unknown";

type ParsedAction = {
  intent: Intent;
  customerName?: string;
  customerPhone?: string;
  productName?: string;
  quantity?: number;
  amountNaira?: number;
  paid?: boolean;
  description?: string;
  category?: string;
  date?: string;
};

@Injectable()
export class ConversationalService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    @Inject(API_ENV) private readonly env: ApiEnv,
    private readonly salesService: SalesService,
  ) {}

  async processInbound(
    inbound: InboundMessage,
    organizationId: string,
    channelIdentityId: string,
    adapter: ChannelAdapter,
  ): Promise<string> {
    const conversationRow = await this.getOrCreateConversation(
      organizationId,
      channelIdentityId,
    );

    let content = inbound.text?.trim() ?? "";
    if (inbound.kind === "voice") {
      content = await this.transcribeVoice(inbound, adapter);
    }

    if (!content) {
      return "I couldn't understand that message. Please send text or a clearer voice note.";
    }

    await this.db.insert(message).values({
      conversationId: conversationRow.id,
      role: "user",
      content,
    });

    const history = await this.db
      .select({ role: message.role, content: message.content })
      .from(message)
      .where(eq(message.conversationId, conversationRow.id))
      .orderBy(desc(message.createdAt))
      .limit(12);

    const action = await this.understand(history.reverse());
    const reply = await this.executeAction(action, organizationId);

    await this.db.insert(message).values({
      conversationId: conversationRow.id,
      role: "assistant",
      content: reply,
      toolName: action.intent,
      toolArgs: action,
    });

    await this.db
      .update(conversation)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(conversation.id, conversationRow.id));

    return reply;
  }

  private async getOrCreateConversation(
    organizationId: string,
    channelIdentityId: string,
  ) {
    const existing = await this.db
      .select()
      .from(conversation)
      .where(
        and(
          eq(conversation.organizationId, organizationId),
          eq(conversation.channelIdentityId, channelIdentityId),
        ),
      )
      .limit(1);

    if (existing[0]) return existing[0];

    const [created] = await this.db
      .insert(conversation)
      .values({
        organizationId,
        channelIdentityId,
        lastMessageAt: new Date(),
      })
      .returning();

    return created;
  }

  private async transcribeVoice(inbound: InboundMessage, adapter: ChannelAdapter): Promise<string> {
    const media = await this.getVoiceMedia(inbound, adapter);
    const form = this.createTranscriptionForm(media.data, media.mimeType, inbound.mediaMimeType);
    const response = await this.requestTranscription(form);
    return this.extractTranscript(response);
  }

  private async getVoiceMedia(inbound: InboundMessage, adapter: ChannelAdapter) {
    if (!inbound.mediaUrl || !adapter.getInboundMedia) {
      throw new BadRequestException("Voice messages are not supported by this channel yet.");
    }
    return adapter.getInboundMedia(inbound.mediaUrl);
  }

  private createTranscriptionForm(
    data: Uint8Array,
    mediaMimeType: string | undefined,
    inboundMimeType: string | undefined,
  ): FormData {
    const form = new FormData();
    const audioBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    form.append("file", new Blob([audioBuffer], { type: mediaMimeType ?? inboundMimeType ?? "audio/ogg" }), "voice.ogg");
    form.append("model", this.env.OPENAI_TRANSCRIPTION_MODEL);
    form.append("prompt", "Transcribe faithfully. The speaker may use Nigerian English, Nigerian Pidgin, Yoruba, Igbo, Hausa, or a mixture. Preserve names, numbers, currencies and business terms.");
    return form;
  }

  private async requestTranscription(form: FormData): Promise<Response> {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.getOpenAiKey()}` },
      body: form,
    });
    if (!response.ok) throw new ServiceUnavailableException("Voice transcription failed.");
    return response;
  }

  private async extractTranscript(response: Response): Promise<string> {
    const body = (await response.json()) as { text?: string };
    if (!body.text?.trim()) throw new BadRequestException("No speech was detected in that voice note.");
    return body.text.trim();
  }

  private async understand(history: Array<{ role: string; content: string | null }>): Promise<ParsedAction> {
    const raw = await this.requestAiResponse(this.buildAiMessages(history));
    return this.parseAiAction(raw);
  }

  private buildAiMessages(
    history: Array<{ role: string; content: string | null }>,
  ): Array<{ role: "assistant" | "user"; content: string }> {
    return history
      .filter((item): item is { role: string; content: string } => Boolean(item.content))
      .map((item) => ({
        role: item.role === "assistant" ? "assistant" as const : "user" as const,
        content: item.content,
      }));
  }
  private validateSaleAction(action: ParsedAction): string | null {
    const checks: Array<[boolean, string]> = [
      [!action.productName, "What product did you sell?"],
      [!action.quantity || action.quantity <= 0, "How many units did you sell?"],
      [!action.amountNaira || action.amountNaira <= 0, "What was the total selling amount?"],
    ];
    return checks.find(([invalid]) => invalid)?.[1] ?? null;
  }
  private async buildSaleInput(
    action: ParsedAction,
    organizationId: string,
    quantity: number,
    amountNaira: number,
  ) {
    const [customerId, existingProduct] = await Promise.all([
      this.findCustomerId(organizationId, action.customerName),
      this.findProduct(organizationId, action.productName!),
    ]);
    const totalKobo = Math.round(amountNaira * 100);
    return {
      customerId,
      items: [this.buildSaleItem(action, existingProduct, quantity, totalKobo)],
      paymentAmountKobo: this.getPaymentAmount(action.paid, totalKobo),
      paymentMethod: "cash" as const,
      notes: "Recorded through Nomidat",
    };
  }

  private buildSaleItem(
    action: ParsedAction,
    existingProduct: { id: string; name: string } | undefined,
    quantity: number,
    totalKobo: number,
  ) {
    return {
      productId: existingProduct?.id,
      productName: existingProduct?.name ?? action.productName!,
      quantity,
      unitPriceKobo: Math.floor(totalKobo / quantity),
      lineTotalKobo: totalKobo,
    };
  }

  private getPaymentAmount(paid: boolean | undefined, totalKobo: number): number {
    return paid ? totalKobo : 0;
  }

