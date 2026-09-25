import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, count, eq, gte, lt, lte, sql } from "@nomidat/db";
import { contact, order, product } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { ContactsService } from "../contacts/contacts.service";
import { InvoiceDeliveryService } from "../invoices/invoice-delivery.service";
import { InvoicesService } from "../invoices/invoices.service";
import { ReportsService } from "../reports/reports.service";
import { PaystackService } from "../payments/providers/paystack/paystack.service";
import type { ParsedAction } from "./types";

@Injectable()
export class ExtendedActionsService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly contacts: ContactsService,
    private readonly invoices: InvoicesService,
    private readonly reports: ReportsService,
    private readonly payments: PaystackService,
    private readonly delivery: InvoiceDeliveryService,
  ) {}

  async executeAction(
    action: ParsedAction,
    organizationId: string,
    userId: string,
  ): Promise<string> {
    switch (action.intent) {
      case "list_low_stock":
        return this.listLowStock(organizationId);
      case "get_order_count":
        return this.getOrderCount(action, organizationId);
      case "get_daily_summary":
      case "get_expense_summary":
        return this.getExpenseSummary(action, organizationId);
      case "list_invoices":
        return this.listInvoices(organizationId);
      case "get_client_folder":
        return this.getClientFolder(action, organizationId);
      case "convert_lead_to_customer":
        return this.convertLeadToCustomer(action, organizationId);
      case "add_note":
        return this.addNote(action, organizationId, userId);
      case "create_invoice":
        return this.createInvoice(action, organizationId);
      case "create_payment_link":
        return this.createPaymentLink(action, organizationId);
      case "send_invoice":
        return this.sendInvoice(action, organizationId);
      default:
        return "Please describe the action you want to take.";
    }
  }

  private async listLowStock(organizationId: string): Promise<string> {
    return JSON.stringify(
      await this.db
        .select({ name: product.name, stock: product.stockQuantity, unit: product.unit })
        .from(product)
        .where(
          and(
            eq(product.organizationId, organizationId),
            eq(product.isActive, true),
            lte(product.stockQuantity, product.lowStockThreshold),
          ),
        )
        .limit(50),
    );
  }

  private async getOrderCount(action: ParsedAction, organizationId: string): Promise<string> {
    const range = this.getRange(action.date);
    const [row] = await this.db
      .select({ count: count() })
      .from(order)
      .where(
        and(
          eq(order.organizationId, organizationId),
          gte(order.createdAt, range.from),
          lt(order.createdAt, range.to),
        ),
      );
    return `${row.count} orders recorded for ${action.date ?? "today"}.`;
  }

  private async getExpenseSummary(action: ParsedAction, organizationId: string): Promise<string> {
    return JSON.stringify(
      await this.reports.getSummary(organizationId, this.getRange(action.date)),
    );
  }

  private async listInvoices(organizationId: string): Promise<string> {
    return JSON.stringify(await this.invoices.listInvoices(organizationId));
  }

  private async getClientFolder(action: ParsedAction, organizationId: string): Promise<string> {
    return JSON.stringify(
      await this.contacts.getClientFolder(
        organizationId,
        await this.getContactId(action, organizationId),
      ),
    );
  }

  private async convertLeadToCustomer(
    action: ParsedAction,
    organizationId: string,
  ): Promise<string> {
    const row = await this.contacts.updateCustomer(
      organizationId,
      await this.getContactId(action, organizationId),
    );
    return `${row.name} is now a customer.`;
  }

  private async addNote(
    action: ParsedAction,
    organizationId: string,
    userId: string,
  ): Promise<string> {
    if (!action.description) return "What should the note say?";
    await this.contacts.createNote(
      organizationId,
      await this.getContactId(action, organizationId),
      userId,
      { body: action.description },
    );
    return "Note added to the client folder.";
  }

  private async createInvoice(action: ParsedAction, organizationId: string): Promise<string> {
    if (!action.items) return "Please include the invoice items, quantities and unit prices.";
    const result = await this.invoices.createInvoice(organizationId, {
      customerId: await this.getContactId(action, organizationId),
      items: action.items.map((item) => ({
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unitPriceKobo: Math.round(item.unitPriceNaira * 100),
      })),
      taxKobo: Math.round((action.taxNaira ?? 0) * 100),
      discountKobo: Math.round((action.discountNaira ?? 0) * 100),
      dueDate: action.date,
    });
    return `Created invoice ${result.invoiceNumber} for NGN ${(result.totalKobo / 100).toLocaleString("en-NG")}. Open Invoices to download or send it.`;
  }

  private async createPaymentLink(action: ParsedAction, organizationId: string): Promise<string> {
    if (!action.orderId || !action.email)
      return "Please provide the sale ID and customer email for the payment link.";
    const result = await this.payments.initializePayment(organizationId, {
      orderId: action.orderId,
      email: action.email,
    });
    return `Payment link: ${result.authorizationUrl}`;
  }

  private async sendInvoice(action: ParsedAction, organizationId: string): Promise<string> {
    if (!action.invoiceId || !action.email)
      return "Please provide the invoice ID and recipient email.";
    await this.delivery.createDelivery(organizationId, action.invoiceId, {
      channel: "email",
      email: action.email,
    });
    return "Invoice sent by email.";
  }

  private getRange(date?: string) {
    const day =
      date ??
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Lagos",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    const from = new Date(day + "T00:00:00+01:00");
    return { from, to: new Date(from.getTime() + 86_400_000) };
  }

  private async getContactId(action: ParsedAction, organizationId: string) {
    if (action.contactId) {
      await this.contacts.getContact(organizationId, action.contactId);
      return action.contactId;
    }
    if (!action.customerName) throw new BadRequestException("Please specify a contact name or ID.");
    const rows = await this.db
      .select({ id: contact.id })
      .from(contact)
      .where(
        and(
          eq(contact.organizationId, organizationId),
          sql`lower(${contact.name}) = lower(${action.customerName})`,
        ),
      )
      .limit(2);
    if (rows.length !== 1)
      throw new BadRequestException(
        "Contact name is missing or ambiguous. Please use the contact ID.",
      );
    return rows[0].id;
  }
}
