import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { and, desc, eq, ilike } from "@nomidat/db";
import {
  contact,
  conversation,
  expense,
  expenseCategory,
  order,
  product,
  message,
} from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { API_ENV } from "../../common/config/env.module";
import type { ApiEnv } from "../../common/config/env";
import type { ChannelAdapter, InboundMessage } from "../channel/types";
import { inboundUpdate } from "@nomidat/db/schema";
import { z } from "zod";
import { SalesService } from "../sales/sales.service";

type AiProvider = "openai" | "gemini";
type TranscriptionProvider = "deepgram" | "whisper";

type Intent =
  | "create_contact"
  | "record_sale"
  | "record_expense"
  | "check_balance"
  | "check_inventory"
  | "summary"
  | "unknown";

const parsedActionSchema = z.object({
  intent: z.enum(["create_contact", "record_sale", "record_expense", "check_balance", "check_inventory", "summary", "unknown"]),
  customerName: z.string().min(1).optional(), customerPhone: z.string().min(1).optional(),
  productName: z.string().min(1).optional(), quantity: z.number().finite().int().positive().optional(),
  amountNaira: z.number().finite().positive().optional(), paid: z.boolean().optional(),
  description: z.string().min(1).optional(), category: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !Number.isNaN(Date.parse(value + "T12:00:00")), "Invalid date").optional(),
}).strict();

type ActionHandler = (action: ParsedAction, organizationId: string) => Promise<string>;

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
  private readonly actionHandlers: Record<Intent, ActionHandler> = {
    create_contact: (action, id) => this.createContact(action, id),
    record_sale: (action, id) => this.recordSale(action, id),
    record_expense: (action, id) => this.recordExpense(action, id),
    check_balance: (action, id) => this.checkBalance(action, id),
    check_inventory: (action, id) => this.checkInventory(action, id),
    summary: (_action, id) => this.summary(id),
    unknown: async () => "I understood the message, but I need a little more information to know what you want me to record.",
  };

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
    const guard = await this.beginInboundUpdate(inbound, organizationId);
    if (guard.status === "completed") return guard.response;
    if (guard.status === "processing") return "This message is already being processed.";
    try {
      const conversationRow = await this.getOrCreateConversation(
      organizationId,
      channelIdentityId,
    );

    let content = inbound.text?.trim() ?? "";
    if (inbound.kind === "voice") {
      content = await this.transcribeVoice(inbound, adapter);
    }

    if (!content) {
      const reply = "I couldn't understand that message. Please send text or a clearer voice note.";
      await this.completeInboundUpdate(guard.id, reply);
      return reply;
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

    await this.completeInboundUpdate(guard.id, reply);
      return reply;
    } catch (error) {
      await this.releaseInboundUpdate(guard.id);
      throw error;
    }
  }

  private async beginInboundUpdate(inbound: InboundMessage, organizationId: string): Promise<{ status: "new"; id: string } | { status: "completed"; response: string } | { status: "processing" }> {
    if (!inbound.rawUpdateId) return { status: "new", id: "" };
    const [created] = await this.db.insert(inboundUpdate).values({ organizationId, provider: inbound.provider, rawUpdateId: inbound.rawUpdateId }).onConflictDoNothing().returning({ id: inboundUpdate.id });
    if (created) return { status: "new", id: created.id };
    const existing = await this.db.select({ id: inboundUpdate.id, response: inboundUpdate.response }).from(inboundUpdate).where(and(
      eq(inboundUpdate.organizationId, organizationId), eq(inboundUpdate.provider, inbound.provider), eq(inboundUpdate.rawUpdateId, inbound.rawUpdateId),
    )).limit(1);
    if (existing[0]?.response !== null && existing[0]?.response !== undefined) return { status: "completed", response: existing[0].response };
    return { status: "processing" };
  }

  private async completeInboundUpdate(id: string, response: string): Promise<void> {
    if (!id) return;
    await this.db.update(inboundUpdate).set({ response, completedAt: new Date() }).where(eq(inboundUpdate.id, id));
  }

  private async releaseInboundUpdate(id: string): Promise<void> {
    if (!id) return;
    await this.db.delete(inboundUpdate).where(eq(inboundUpdate.id, id));
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

  private async transcribeVoice(
    inbound: InboundMessage,
    adapter: ChannelAdapter,
  ): Promise<string> {
    if (!inbound.mediaUrl || !adapter.getInboundMedia) {
      throw new BadRequestException("Voice messages are not supported by this channel yet.");
    }

    const media = await adapter.getInboundMedia(inbound.mediaUrl);
    const audioBuffer = media.data.buffer.slice(
      media.data.byteOffset,
      media.data.byteOffset + media.data.byteLength,
    ) as ArrayBuffer;
    const mimeType = media.mimeType ?? inbound.mediaMimeType ?? "audio/ogg";
    const provider = this.env.TRANSCRIPTION_PROVIDER;

    if (!this.isTranscriptionProviderConfigured(provider)) {
      throw new ServiceUnavailableException(
        `${provider.toUpperCase()} transcription provider is not configured.`,
      );
    }

    try {
      const transcript = await this.transcribeWithProvider(
        provider,
        audioBuffer,
        mimeType,
      );

      if (!transcript.trim()) {
        throw new BadRequestException("No speech was detected in that voice note.");
      }

      return transcript.trim();
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException("Voice transcription failed.");
    }
  }

  private transcribeWithProvider(
    provider: TranscriptionProvider,
    audioBuffer: ArrayBuffer,
    mimeType: string,
  ): Promise<string> {
    return provider === "deepgram"
      ? this.transcribeWithDeepgram(audioBuffer, mimeType)
      : this.transcribeWithWhisper(audioBuffer, mimeType);
  }

  private async transcribeWithDeepgram(
    audioBuffer: ArrayBuffer,
    mimeType: string,
  ): Promise<string> {
    const response = await fetch(
      `https://api.deepgram.com/v1/listen?model=${encodeURIComponent(this.env.DEEPGRAM_MODEL)}&smart_format=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${this.getDeepgramKey()}`,
          "Content-Type": mimeType,
        },
        body: audioBuffer,
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!response.ok) {
      throw new ServiceUnavailableException("Deepgram transcription failed.");
    }

    const body = (await response.json()) as {
      results?: {
        channels?: Array<{
          alternatives?: Array<{ transcript?: string }>;
        }>;
      };
    };

    return body.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  }

  private async transcribeWithWhisper(
    audioBuffer: ArrayBuffer,
    mimeType: string,
  ): Promise<string> {
    const form = new FormData();
    form.append("file", new Blob([audioBuffer], { type: mimeType }), "voice.ogg");
    form.append("model", this.env.WHISPER_MODEL);
    form.append(
      "prompt",
      "Transcribe faithfully. The speaker may use Nigerian English, Nigerian Pidgin, Yoruba, Igbo, Hausa, or a mixture. Preserve names, numbers, currencies and business terms.",
    );

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.getWhisperKey()}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException("Whisper transcription failed.");
    }

    const body = (await response.json()) as { text?: string };
    return body.text ?? "";
  }

  private async understand(
    history: Array<{ role: string; content: string | null }>,
  ): Promise<ParsedAction> {
    const messages = history
      .filter((item): item is { role: string; content: string } => Boolean(item.content))
      .map((item) => ({
        role: item.role === "assistant" ? "assistant" as const : "user" as const,
        content: item.content,
      }));

    const system = `You are Nomidat, an SME business assistant for Nigerian businesses.
Understand natural English, Nigerian Pidgin, Yoruba, Igbo and Hausa, including mixed language.
Do not translate for the user. Extract business intent and structured facts.

Return ONLY JSON:
{
  "intent": "create_contact|record_sale|record_expense|check_balance|check_inventory|summary|unknown",
  "customerName": string?,
  "customerPhone": string?,
  "productName": string?,
  "quantity": number?,
  "amountNaira": number?,
  "paid": boolean?,
  "description": string?,
  "category": string?,
  "date": "YYYY-MM-DD"?
}

Rules:
- A sale on credit means paid=false.
- If the user says someone owes them money without enough information for a sale, use check_balance only when asking a question; otherwise unknown.
- Preserve the numeric amount as naira, not kobo.
- Never invent missing names, amounts, quantities or dates.
- For "how much", "what is", "show me", use a query intent.
- "summary" means a general business summary.
`;

    const provider = this.env.AI_PROVIDER;

    if (!this.isAiProviderConfigured(provider)) {
      throw new ServiceUnavailableException(
        `${provider.toUpperCase()} AI provider is not configured.`,
      );
    }

    try {
      const raw = await this.generateAiResponse(provider, system, messages);
      return this.parseAiAction(raw);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException("AI processing failed.");
    }
  }

  private generateAiResponse(
    provider: AiProvider,
    system: string,
    messages: Array<{ role: "assistant" | "user"; content: string }>,
  ): Promise<string> {
    return provider === "gemini"
      ? this.generateGeminiResponse(system, messages)
      : this.generateOpenAiResponse(system, messages);
  }

  private async generateOpenAiResponse(
    system: string,
    messages: Array<{ role: "assistant" | "user"; content: string }>,
  ): Promise<string> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.getOpenAiKey()}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        model: this.env.OPENAI_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException("OpenAI AI processing failed.");
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = body.choices?.[0]?.message?.content;
    if (!raw) throw new ServiceUnavailableException("OpenAI returned no result.");
    return raw;
  }

  private async generateGeminiResponse(
    system: string,
    messages: Array<{ role: "assistant" | "user"; content: string }>,
  ): Promise<string> {
    const contents = messages.map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.env.GEMINI_MODEL)}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": this.getGeminiKey(),
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: system }],
          },
          contents,
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      throw new ServiceUnavailableException("Gemini AI processing failed.");
    }

    const body = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const raw = body.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!raw) throw new ServiceUnavailableException("Gemini returned no result.");
    return raw;
  }

  private parseAiAction(raw: string): ParsedAction {
    const normalized = raw
      .trim()
      .replace(/^\`\`\`(?:json)?\s*/i, "")
      .replace(/\s*\`\`\`$/i, "");

    try {
      const parsed = parsedActionSchema.safeParse(JSON.parse(normalized));
      if (!parsed.success) {
        throw new ServiceUnavailableException("AI returned an invalid action.");
      }
      return parsed.data;
    } catch {
      throw new ServiceUnavailableException("AI returned an invalid action.");
    }
  }

  private isAiProviderConfigured(provider: AiProvider): boolean {
    return provider === "gemini"
      ? Boolean(this.env.GEMINI_API_KEY)
      : Boolean(this.env.OPENAI_API_KEY);
  }

  private isTranscriptionProviderConfigured(
    provider: TranscriptionProvider,
  ): boolean {
    return provider === "deepgram"
      ? Boolean(this.env.DEEPGRAM_API_KEY)
      : Boolean(this.env.WHISPER_API_KEY);
  }
  private executeAction(action: ParsedAction, organizationId: string): Promise<string> {
    return this.actionHandlers[action.intent](action, organizationId);
  }

  private async createContact(action: ParsedAction, organizationId: string): Promise<string> {
    if (!action.customerName) return "What is the customer's name?";

    const existing = await this.db
      .select()
      .from(contact)
      .where(
        and(
          eq(contact.organizationId, organizationId),
          ilike(contact.name, action.customerName),
        ),
      )
      .limit(1);

    if (existing[0]) return `${existing[0].name} is already in your contacts.`;

    const [created] = await this.db
      .insert(contact)
      .values({
        organizationId,
        name: action.customerName,
        phone: action.customerPhone,
        kind: "customer",
        source: "conversational",
      })
      .returning();

    return `Recorded ${created.name} as a customer.`;
  }

  private async recordExpense(action: ParsedAction, organizationId: string): Promise<string> {
    if (!action.amountNaira || action.amountNaira <= 0) {
      return "How much was the expense?";
    }

    const categories = await this.db
      .select()
      .from(expenseCategory)
      .where(eq(expenseCategory.isDefault, true));

    const category = action.category
      ? categories.find((item) => item.name.toLowerCase() === action.category?.toLowerCase())
      : categories.find((item) => item.name.toLowerCase().includes("other"));

    const [created] = await this.db
      .insert(expense)
      .values({
        organizationId,
        categoryId: category?.id,
        amountKobo: Math.round(action.amountNaira * 100),
        description: action.description ?? "Recorded through Nomidat",
        spentAt: action.date ? new Date(`${action.date}T12:00:00`) : new Date(),
        paymentMethod: "cash",
      })
      .returning();

    return `Recorded ₦${(created.amountKobo / 100).toLocaleString("en-NG")} expense.`;
  }

  private async recordSale(action: ParsedAction, organizationId: string): Promise<string> {
    const validationError = this.validateSaleAction(action);
    if (validationError) return validationError;
    const quantity = action.quantity!;
    const amountNaira = action.amountNaira!;
    const [customerId, existingProduct] = await Promise.all([
      this.findCustomerId(organizationId, action.customerName),
      this.findProduct(organizationId, action.productName!),
    ]);
    const totalKobo = Math.round(amountNaira * 100);
    const result = await this.salesService.createSale(organizationId, null, {
      customerId: customerId ?? undefined,
      items: [{ productId: existingProduct?.id, productName: existingProduct?.name ?? action.productName!, quantity,
        unitPriceKobo: Math.floor(totalKobo / quantity), lineTotalKobo: totalKobo }],
      paymentAmountKobo: action.paid ? totalKobo : 0, paymentMethod: "cash", notes: "Recorded through Nomidat",
    });
    const balanceText = result.balanceKobo > 0 ? " Outstanding: ₦" + (result.balanceKobo / 100).toLocaleString("en-NG") + "." : "";
    return "Recorded " + quantity + " × " + action.productName + " for ₦" + amountNaira.toLocaleString("en-NG") + " " + (action.paid ? "paid" : "on credit") + "." + balanceText + " Order " + result.id.slice(0, 8) + ".";
  }

  private validateSaleAction(action: ParsedAction): string | null {
    if (!action.productName) return "What product did you sell?";
    if (!action.quantity) return "How many units did you sell?";
    if (!action.amountNaira) return "What was the total selling amount?";
    return null;
  }

  private async findCustomerId(organizationId: string, name?: string): Promise<string | null> {
    if (!name) return null;
    const [customer] = await this.db.select({ id: contact.id }).from(contact).where(and(eq(contact.organizationId, organizationId), ilike(contact.name, name))).limit(1);
    return customer?.id ?? null;
  }

  private async findProduct(organizationId: string, name: string) {
    const [item] = await this.db.select({ id: product.id, name: product.name }).from(product).where(and(eq(product.organizationId, organizationId), ilike(product.name, name))).limit(1);
    return item;
  }
  private async checkBalance(action: ParsedAction, organizationId: string): Promise<string> {
    if (!action.customerName) return "Which customer should I check?";

    const customers = await this.db
      .select()
      .from(contact)
      .where(
        and(eq(contact.organizationId, organizationId), ilike(contact.name, action.customerName)),
      )
      .limit(1);

    const customer = customers[0];
    if (!customer) return `I couldn't find ${action.customerName} in your customers.`;

    const rows = await this.db
      .select({ totalKobo: order.totalKobo })
      .from(order)
      .where(
        and(
          eq(order.organizationId, organizationId),
          eq(order.contactId, customer.id),
          eq(order.status, "pending"),
        ),
      );

    const total = rows.reduce((sum, row) => sum + row.totalKobo, 0);
    return `${customer.name} currently owes ₦${(total / 100).toLocaleString("en-NG")}.`;
  }

  private async checkInventory(action: ParsedAction, organizationId: string): Promise<string> {
    if (!action.productName) return "Which product should I check?";

    const rows = await this.db
      .select()
      .from(product)
      .where(
        and(eq(product.organizationId, organizationId), ilike(product.name, action.productName)),
      )
      .limit(1);

    const item = rows[0];
    if (!item) return `I couldn't find ${action.productName} in your inventory.`;

    return `${item.name}: ${item.stockQuantity} ${item.unit} in stock.`;
  }

  private async summary(organizationId: string): Promise<string> {
    const orders = await this.db
      .select({ totalKobo: order.totalKobo })
      .from(order)
      .where(and(eq(order.organizationId, organizationId), eq(order.status, "paid")));

    const expenses = await this.db
      .select({ amountKobo: expense.amountKobo })
      .from(expense)
      .where(eq(expense.organizationId, organizationId));

    const revenue = orders.reduce((sum, row) => sum + row.totalKobo, 0);
    const spending = expenses.reduce((sum, row) => sum + row.amountKobo, 0);

    return `Business summary: ₦${(revenue / 100).toLocaleString("en-NG")} paid sales and ₦${(spending / 100).toLocaleString("en-NG")} recorded expenses. Outstanding credit is available by asking "who owes me?".`;
  }

  private getOpenAiKey(): string {
    if (!this.env.OPENAI_API_KEY) {
      throw new ServiceUnavailableException("OPENAI_API_KEY is not configured.");
    }
    return this.env.OPENAI_API_KEY;
  }

  private getGeminiKey(): string {
    if (!this.env.GEMINI_API_KEY) {
      throw new ServiceUnavailableException("GEMINI_API_KEY is not configured.");
    }
    return this.env.GEMINI_API_KEY;
  }

  private getDeepgramKey(): string {
    if (!this.env.DEEPGRAM_API_KEY) {
      throw new ServiceUnavailableException("DEEPGRAM_API_KEY is not configured.");
    }
    return this.env.DEEPGRAM_API_KEY;
  }

  private getWhisperKey(): string {
    if (!this.env.WHISPER_API_KEY) {
      throw new ServiceUnavailableException("WHISPER_API_KEY is not configured.");
    }
    return this.env.WHISPER_API_KEY;
  }
}
