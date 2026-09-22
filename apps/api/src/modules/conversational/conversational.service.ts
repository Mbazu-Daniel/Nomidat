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
import { ReportsService } from "../reports/reports.service";
import { SalesService } from "../sales/sales.service";

type Intent =
  | "create_contact"
  | "record_sale"
  | "record_expense"
  | "check_balance"
  | "check_inventory"
  | "summary"
  | "sales_report"
  | "expense_report"
  | "top_products"
  | "customer_balances"
  | "inventory_report"
  | "unknown";

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
    create_contact: (action, organizationId) => this.createContact(action, organizationId),
    record_sale: (action, organizationId) => this.recordSale(action, organizationId),
    record_expense: (action, organizationId) => this.recordExpense(action, organizationId),
    check_balance: (action, organizationId) => this.checkBalance(action, organizationId),
    check_inventory: (action, organizationId) => this.checkInventory(action, organizationId),
    summary: (_action, organizationId) => this.summary(organizationId),
    sales_report: (_action, organizationId) => this.salesReport(organizationId),
    expense_report: (_action, organizationId) => this.expenseReport(organizationId),
    top_products: (_action, organizationId) => this.topProductsReport(organizationId),
    customer_balances: (_action, organizationId) => this.customerBalancesReport(organizationId),
    inventory_report: (_action, organizationId) => this.inventoryReport(organizationId),
    unknown: async () => "I understood the message, but I need a little more information to know what you want me to record.",
  };

  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    @Inject(API_ENV) private readonly env: ApiEnv,
    private readonly reports: ReportsService,
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
    const content = await this.getInboundContent(inbound, adapter);

    if (!content) {
      return "I couldn't understand that message. Please send text or a clearer voice note.";
    }

    const claim = await this.claimInboundMessage(conversationRow.id, inbound, content);
    if (!claim.claimed) return claim.response;

    return this.processClaimedMessage(conversationRow.id, organizationId, inbound);
  }

  private async getInboundContent(
    inbound: InboundMessage,
    adapter: ChannelAdapter,
  ): Promise<string> {
    if (inbound.kind === "voice") {
      return (await this.transcribeVoice(inbound, adapter)).trim();
    }
    return inbound.text?.trim() ?? "";
  }

  private async processClaimedMessage(
    conversationId: string,
    organizationId: string,
    inbound: InboundMessage,
  ): Promise<string> {
    const history = await this.getConversationHistory(conversationId);
    const action = await this.understand(history);
    const reply = await this.executeAction(action, organizationId);

    await this.persistAssistantMessage(conversationId, inbound, action, reply);
    await this.db
      .update(conversation)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(conversation.id, conversationId));

    return reply;
  }

  private async getConversationHistory(conversationId: string) {
    const history = await this.db
      .select({ role: message.role, content: message.content })
      .from(message)
      .where(eq(message.conversationId, conversationId))
      .orderBy(desc(message.createdAt))
      .limit(12);

    return history.reverse();
  }

  private async persistAssistantMessage(
    conversationId: string,
    inbound: InboundMessage,
    action: ParsedAction,
    reply: string,
  ) {
    await this.db.insert(message).values({
      conversationId,
      role: "assistant",
      content: reply,
      toolName: action.intent,
      toolArgs: action,
    });

    if (!inbound.rawUpdateId) return;

    await this.db
      .update(message)
      .set({ inboundResponse: reply })
      .where(
        and(
          eq(message.conversationId, conversationId),
          eq(message.provider, inbound.provider),
          eq(message.rawUpdateId, inbound.rawUpdateId),
          eq(message.role, "user"),
        ),
      );
  }

  private async claimInboundMessage(
    conversationId: string,
    inbound: InboundMessage,
    content: string,
  ): Promise<{ claimed: boolean; response: string }> {
    if (!inbound.rawUpdateId) return this.insertInboundMessage(conversationId, content);

    const created = await this.tryClaimInboundMessage(conversationId, inbound, content);
    if (created) return { claimed: true, response: "" };

    return {
      claimed: false,
      response: await this.getInboundResponse(inbound),
    };
  }

  private async insertInboundMessage(conversationId: string, content: string) {
    await this.db.insert(message).values({ conversationId, role: "user", content });
    return { claimed: true, response: "" };
  }

  private async tryClaimInboundMessage(
    conversationId: string,
    inbound: InboundMessage,
    content: string,
  ) {
    const [created] = await this.db
      .insert(message)
      .values({
        conversationId,
        provider: inbound.provider,
        rawUpdateId: inbound.rawUpdateId,
        role: "user",
        content,
      })
      .onConflictDoNothing()
      .returning({ id: message.id });
    return Boolean(created);
  }

  private async getInboundResponse(inbound: InboundMessage) {
    const [existing] = await this.db
      .select({ inboundResponse: message.inboundResponse })
      .from(message)
      .where(
        and(
          eq(message.provider, inbound.provider),
          eq(message.rawUpdateId, inbound.rawUpdateId!),
          eq(message.role, "user"),
        ),
      )
      .limit(1);

    return existing?.inboundResponse ??
      "That message is already being processed. Please wait for the response.";
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
    const audioBuffer = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer;
    form.append(
      "file",
      new Blob([audioBuffer], { type: mediaMimeType ?? inboundMimeType ?? "audio/ogg" }),
      "voice.ogg",
    );
    form.append("model", this.env.OPENAI_TRANSCRIPTION_MODEL);
    form.append(
      "prompt",
      "Transcribe faithfully. The speaker may use Nigerian English, Nigerian Pidgin, Yoruba, Igbo, Hausa, or a mixture. Preserve names, numbers, currencies and business terms.",
    );
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
  "intent": "create_contact|record_sale|record_expense|check_balance|check_inventory|summary|sales_report|expense_report|top_products|customer_balances|inventory_report|unknown",
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

  private validateSaleAction(action: ParsedAction): string | null {
    const missing = [
      [!action.productName, "What product did you sell?"],
      [!this.isPositiveNumber(action.quantity), "How many units did you sell?"],
      [!this.isPositiveNumber(action.amountNaira), "What was the total selling amount?"],
    ] as const;

    return missing.find(([invalid]) => invalid)?.[1] ?? null;
  }

  private isPositiveNumber(value: number | undefined): value is number {
    return typeof value === "number" && value > 0;
  }

  private async findCustomerId(
    organizationId: string,
    customerName?: string,
  ): Promise<string | null> {
    if (!customerName) return null;
    const rows = await this.db
      .select()
      .from(contact)
      .where(
        and(
          eq(contact.organizationId, organizationId),
          ilike(contact.name, customerName),
        ),
      )
      .limit(1);
    return rows[0]?.id ?? null;
  }

  private async findProduct(organizationId: string, productName: string) {
    const rows = await this.db
      .select()
      .from(product)
      .where(
        and(
          eq(product.organizationId, organizationId),
          ilike(product.name, productName),
        ),
      )
      .limit(1);
    return rows[0];
  }

  private async recordSale(action: ParsedAction, organizationId: string): Promise<string> {
    const validationError = this.validateSaleAction(action);
    if (validationError) return validationError;

    const quantity = action.quantity!;
    const amountNaira = action.amountNaira!;
    const result = await this.salesService.createSale(
      organizationId,
      null,
      await this.buildSaleInput(action, organizationId, quantity, amountNaira),
    );

    return this.formatSaleResponse(action, quantity, amountNaira, result);
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
      customerId: customerId ?? undefined,
      items: [this.buildSaleItem(action, existingProduct, quantity, totalKobo)],
      paymentAmountKobo: action.paid ? totalKobo : 0,
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

  private formatSaleResponse(
    action: ParsedAction,
    quantity: number,
    amountNaira: number,
    result: { id: string; balanceKobo: number },
  ): string {
    const paymentText = action.paid ? "paid" : "on credit";
    const balanceText = result.balanceKobo > 0
      ? ` Outstanding: ₦${(result.balanceKobo / 100).toLocaleString("en-NG")}.`
      : "";

    return `Recorded ${quantity} × ${action.productName} for ₦${amountNaira.toLocaleString("en-NG")} ${paymentText}.${balanceText} Order ${result.id.slice(0, 8)}.`;
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
    const report = await this.reports.getSummary(
      organizationId,
      this.reports.getDefaultRange(),
    );

    return `Last 30 days: ₦${this.formatMoney(report.salesKobo)} in sales, ₦${this.formatMoney(report.collectedKobo)} collected, ₦${this.formatMoney(report.expensesKobo)} in expenses and ₦${this.formatMoney(report.outstandingCreditKobo)} outstanding. Approximate profit is ₦${this.formatMoney(report.profitApproxKobo)} and net cash flow is ₦${this.formatMoney(report.netCashflowKobo)}.`;
  }

  private async salesReport(organizationId: string): Promise<string> {
    const range = this.reports.getDefaultRange();
    const [summary, trend] = await Promise.all([
      this.reports.getSummary(organizationId, range),
      this.reports.getSalesTrend(organizationId, range),
    ]);
    const latest = trend.at(-1);

    return `Last 30 days sales: ₦${this.formatMoney(summary.salesKobo)} across ${summary.salesCount} sales. Collected ₦${this.formatMoney(summary.collectedKobo)}. ${latest ? `Latest day: ₦${this.formatMoney(latest.salesKobo)} from ${latest.saleCount} sales.` : "No sales were recorded in this period."}`;
  }

  private async expenseReport(organizationId: string): Promise<string> {
    const rows = await this.reports.getExpenseBreakdown(
      organizationId,
      this.reports.getDefaultRange(),
    );

    if (rows.length === 0) return "No expenses were recorded in the last 30 days.";

    return `Last 30 days expenses: ${rows
      .slice(0, 5)
      .map((row) => `${row.category}: ₦${this.formatMoney(row.amountKobo)}`)
      .join(", ")}.`;
  }

  private async topProductsReport(organizationId: string): Promise<string> {
    const rows = await this.reports.getTopProducts(
      organizationId,
      this.reports.getDefaultRange(),
      5,
    );

    if (rows.length === 0) return "No product sales were recorded in the last 30 days.";

    return `Top products in the last 30 days: ${rows
      .map((row, index) => `${index + 1}. ${row.productName} (${row.quantity} units, ₦${this.formatMoney(row.salesKobo)})`)
      .join("; ")}.`;
  }

  private async customerBalancesReport(organizationId: string): Promise<string> {
    const rows = await this.reports.getCustomerBalances(organizationId, 5);

    if (rows.length === 0) return "No customers currently have outstanding balances.";

    return `Outstanding customer balances: ${rows
      .map((row) => `${row.customerName}: ₦${this.formatMoney(row.balanceKobo)}`)
      .join(", ")}.`;
  }

  private async inventoryReport(organizationId: string): Promise<string> {
    const report = await this.reports.getInventoryHealth(organizationId);

    if (report.productCount === 0) return "You have no products in inventory.";

    const lowStockNames = report.lowStock.slice(0, 5).map((item) => item.name).join(", ");
    const suffix = lowStockNames ? ` Low-stock items: ${lowStockNames}.` : "";

    return `Inventory: ${report.productCount} products worth about ₦${this.formatMoney(report.inventoryValueKobo)}, ${report.lowStockCount} low-stock and ${report.outOfStockCount} out of stock.${suffix}`;
  }

  private formatMoney(kobo: number): string {
    return (kobo / 100).toLocaleString("en-NG");
  }

  private getOpenAiKey(): string {
    if (!this.env.OPENAI_API_KEY) {
      throw new ServiceUnavailableException("OPENAI_API_KEY is not configured.");
    }
    return this.env.OPENAI_API_KEY;
  }
}
