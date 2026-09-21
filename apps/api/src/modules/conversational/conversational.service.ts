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

    await this.db.db.insert(message).values({
      conversationId: conversationRow.id,
      role: "user",
      content,
    });

    const history = await this.db.db
      .select({ role: message.role, content: message.content })
      .from(message)
      .where(eq(message.conversationId, conversationRow.id))
      .orderBy(desc(message.createdAt))
      .limit(12);

    const action = await this.understand(history.reverse());
    const reply = await this.executeAction(action, organizationId);

    await this.db.db.insert(message).values({
      conversationId: conversationRow.id,
      role: "assistant",
      content: reply,
      toolName: action.intent,
      toolArgs: action,
    });

    await this.db.db
      .update(conversation)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(conversation.id, conversationRow.id));

    return reply;
  }

  private async getOrCreateConversation(
    organizationId: string,
    channelIdentityId: string,
  ) {
    const existing = await this.db.db
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

    const [created] = await this.db.db
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
    const form = new FormData();
    const audioBuffer = media.data.buffer.slice(
      media.data.byteOffset,
      media.data.byteOffset + media.data.byteLength,
    ) as ArrayBuffer;
    form.append(
      "file",
      new Blob([audioBuffer], { type: media.mimeType ?? inbound.mediaMimeType ?? "audio/ogg" }),
      "voice.ogg",
    );
    form.append("model", this.env.OPENAI_TRANSCRIPTION_MODEL);
    form.append(
      "prompt",
      "Transcribe faithfully. The speaker may use Nigerian English, Nigerian Pidgin, Yoruba, Igbo, Hausa, or a mixture. Preserve names, numbers, currencies and business terms.",
    );

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.getOpenAiKey()}` },
      body: form,
    });

    if (!response.ok) {
      throw new ServiceUnavailableException("Voice transcription failed.");
    }

    const body = (await response.json()) as { text?: string };
    if (!body.text?.trim()) {
      throw new BadRequestException("No speech was detected in that voice note.");
    }

    return body.text.trim();
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

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.getOpenAiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.env.OPENAI_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException("AI processing failed.");
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = body.choices?.[0]?.message?.content;
    if (!raw) throw new ServiceUnavailableException("AI returned no result.");

    try {
      return JSON.parse(raw) as ParsedAction;
    } catch {
      throw new ServiceUnavailableException("AI returned an invalid action.");
    }
  }

  private async executeAction(action: ParsedAction, organizationId: string): Promise<string> {
    switch (action.intent) {
      case "create_contact":
        return this.createContact(action, organizationId);
      case "record_expense":
        return this.recordExpense(action, organizationId);
      case "record_sale":
        return this.recordSale(action, organizationId);
      case "check_balance":
        return this.checkBalance(action, organizationId);
      case "check_inventory":
        return this.checkInventory(action, organizationId);
      case "summary":
        return this.summary(organizationId);
      default:
        return "I understood the message, but I need a little more information to know what you want me to record.";
    }
  }

  private async createContact(action: ParsedAction, organizationId: string): Promise<string> {
    if (!action.customerName) return "What is the customer's name?";

    const existing = await this.db.db
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

    const [created] = await this.db.db
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

    const categories = await this.db.db
      .select()
      .from(expenseCategory)
      .where(eq(expenseCategory.isDefault, true));

    const category = action.category
      ? categories.find((item) => item.name.toLowerCase() === action.category?.toLowerCase())
      : categories.find((item) => item.name.toLowerCase().includes("other"));

    const [created] = await this.db.db
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
    if (!action.productName) return "What product did you sell?";
    if (!action.quantity || action.quantity <= 0) return "How many units did you sell?";
    if (!action.amountNaira || action.amountNaira <= 0) return "What was the total selling amount?";
    const quantity = action.quantity;

    let customerId: string | undefined;
    if (action.customerName) {
      const existing = await this.db.db
        .select({ id: contact.id })
        .from(contact)
        .where(
          and(
            eq(contact.organizationId, organizationId),
            ilike(contact.name, action.customerName),
          ),
        )
        .limit(1);
      customerId = existing[0]?.id;
    }

    const existingProduct = await this.db.db
      .select({ id: product.id, name: product.name })
      .from(product)
      .where(
        and(
          eq(product.organizationId, organizationId),
          ilike(product.name, action.productName),
        ),
      )
      .limit(1);

    const totalKobo = Math.round(action.amountNaira * 100);
    const result = await this.salesService.createSale(organizationId, null, {
      customerId,
      items: [
        {
          productId: existingProduct[0]?.id,
          productName: existingProduct[0]?.name ?? action.productName,
          quantity,
          unitPriceKobo: Math.floor(totalKobo / quantity),
          lineTotalKobo: totalKobo,
        },
      ],
      paymentAmountKobo: action.paid ? totalKobo : 0,
      paymentMethod: "cash",
      notes: "Recorded through Nomidat",
    });

    const paymentText = action.paid ? "paid" : "on credit";
    const balanceText = result.balanceKobo > 0
      ? ` Outstanding: ₦${(result.balanceKobo / 100).toLocaleString("en-NG")}.`
      : "";

    return `Recorded ${quantity} × ${action.productName} for ₦${action.amountNaira.toLocaleString("en-NG")} ${paymentText}.${balanceText} Order ${result.id.slice(0, 8)}.`;
  }

  private async checkBalance(action: ParsedAction, organizationId: string): Promise<string> {
    if (!action.customerName) return "Which customer should I check?";

    const customers = await this.db.db
      .select()
      .from(contact)
      .where(
        and(eq(contact.organizationId, organizationId), ilike(contact.name, action.customerName)),
      )
      .limit(1);

    const customer = customers[0];
    if (!customer) return `I couldn't find ${action.customerName} in your customers.`;

    const rows = await this.db.db
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

    const rows = await this.db.db
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
    const orders = await this.db.db
      .select({ totalKobo: order.totalKobo })
      .from(order)
      .where(and(eq(order.organizationId, organizationId), eq(order.status, "paid")));

    const expenses = await this.db.db
      .select({ amountKobo: expense.amountKobo })
      .from(expense)
      .where(eq(expense.organizationId, organizationId));

    const revenue = orders.reduce((sum, row) => sum + row.totalKobo, 0);
    const spending = expenses.reduce((sum, row) => sum + row.amountKobo, 0);

    return `Business summary: ₦${(revenue / 100).toLocaleString("en-NG")} paid sales and ₦${(spending / 100).toLocaleString("en-NG")} recorded expenses. Outstanding credit is available by asking "who owes me?"`;
  }

  private getOpenAiKey(): string {
    if (!this.env.OPENAI_API_KEY) {
      throw new ServiceUnavailableException("OPENAI_API_KEY is not configured.");
    }
    return this.env.OPENAI_API_KEY;
  }
}
