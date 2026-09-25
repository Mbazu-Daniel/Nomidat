import { PictureActionsService } from "./picture-actions.service";
import { ExtendedActionsService } from "./extended-actions.service";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, ilike, sql, or, isNull, sum } from "@nomidat/db";
import { contact, expense, expenseCategory, order, product, payment } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { SalesService } from "../sales/sales.service";
import type { ParsedAction } from "./types";

@Injectable()
export class ActionsService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly salesService: SalesService,
    private readonly extended: ExtendedActionsService,
    private readonly pictureActions: PictureActionsService,
  ) {}

  async executeAction(
    action: ParsedAction,
    organizationId: string,
    userId: string,
  ): Promise<string> {
    if (action.intent === "create_product" || (action.intent === "record_sale" && action.items))
      return this.pictureActions.execute(action, organizationId, userId);
    const handlers: Partial<Record<ParsedAction["intent"], () => Promise<string> | string>> = {
      create_contact: () => this.createContact(action, organizationId),
      record_sale: () => this.recordSale(action, organizationId),
      record_expense: () => this.recordExpense(action, organizationId),
      check_balance: () => this.checkBalance(action, organizationId),
      check_inventory: () => this.checkInventory(action, organizationId),
      summary: () => this.summary(organizationId),
      unknown: () =>
        "Try checking stock, recording a sale or expense, adding a customer, or asking for a summary.",
    };
    return (
      handlers[action.intent]?.() ?? this.extended.executeAction(action, organizationId, userId)
    );
  }

  private async createContact(action: ParsedAction, organizationId: string): Promise<string> {
    if (!action.customerName) return "What is the customer's name?";

    const existing = await this.db
      .select()
      .from(contact)
      .where(
        and(eq(contact.organizationId, organizationId), ilike(contact.name, action.customerName)),
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
      .where(
        or(
          eq(expenseCategory.organizationId, organizationId),
          and(isNull(expenseCategory.organizationId), eq(expenseCategory.isDefault, true)),
        ),
      );

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
        paymentMethod: action.paymentMethod ?? "cash",
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
    if (action.customerName && !customerId)
      return `I could not find ${action.customerName}. Please add the contact first.`;
    const totalKobo = Math.round(amountNaira * 100);
    const result = await this.salesService.createSale(organizationId, null, {
      customerId: customerId ?? undefined,
      items: [
        {
          productId: existingProduct?.id,
          productName: existingProduct?.name ?? action.productName!,
          quantity,
          unitPriceKobo: Math.floor(totalKobo / quantity),
          lineTotalKobo: totalKobo,
        },
      ],
      paymentAmountKobo: action.paid ? totalKobo : 0,
      paymentMethod: "cash",
      notes: "Recorded through Nomidat",
    });
    const balanceText =
      result.balanceKobo > 0
        ? " Outstanding: ₦" + (result.balanceKobo / 100).toLocaleString("en-NG") + "."
        : "";
    return (
      "Recorded " +
      quantity +
      " × " +
      action.productName +
      " for ₦" +
      amountNaira.toLocaleString("en-NG") +
      " " +
      (action.paid ? "paid" : "on credit") +
      "." +
      balanceText +
      " Order " +
      result.id.slice(0, 8) +
      "."
    );
  }

  private validateSaleAction(action: ParsedAction): string | null {
    if (!action.productName) return "What product did you sell?";
    if (!action.quantity) return "How many units did you sell?";
    if (!action.amountNaira) return "What was the total selling amount?";
    return null;
  }

  private async findCustomerId(organizationId: string, name?: string): Promise<string | null> {
    if (!name) return null;
    const [customer] = await this.db
      .select({ id: contact.id })
      .from(contact)
      .where(
        and(
          eq(contact.organizationId, organizationId),
          sql`lower(${contact.name}) = lower(${name})`,
        ),
      )
      .limit(1);
    return customer?.id ?? null;
  }

  private async findProduct(organizationId: string, name: string) {
    const [item] = await this.db
      .select({ id: product.id, name: product.name })
      .from(product)
      .where(
        and(
          eq(product.organizationId, organizationId),
          sql`lower(${product.name}) = lower(${name})`,
        ),
      )
      .limit(1);
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
      .select({
        totalKobo: sql<number>`${order.totalKobo} - coalesce((select sum(${payment.amountKobo}) from ${payment} where ${payment.orderId} = "orders"."id" and ${payment.organizationId} = ${organizationId}), 0)`,
      })
      .from(order)
      .where(
        and(
          eq(order.organizationId, organizationId),
          eq(order.contactId, customer.id),
          eq(order.status, "pending"),
        ),
      );

    const total = rows.reduce((sum, row) => sum + Number(row.totalKobo), 0);
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
    const [[collected], [spent]] = await Promise.all([
      this.db
        .select({ amount: sum(payment.amountKobo) })
        .from(payment)
        .where(eq(payment.organizationId, organizationId)),
      this.db
        .select({ amount: sum(expense.amountKobo) })
        .from(expense)
        .where(eq(expense.organizationId, organizationId)),
    ]);
    const revenue = Number(collected.amount ?? 0);
    const spending = Number(spent.amount ?? 0);
    return `Business summary: NGN ${(revenue / 100).toLocaleString("en-NG")} collected and NGN ${(spending / 100).toLocaleString("en-NG")} expenses. Net cash flow: NGN ${((revenue - spending) / 100).toLocaleString("en-NG")}.`;
  }
}
