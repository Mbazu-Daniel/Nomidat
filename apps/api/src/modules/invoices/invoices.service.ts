import { getInvoiceDocument } from "./invoice-document-query";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq } from "@nomidat/db";
import { contact, invoice, invoiceItem, order, orderItem, product } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import type { CreateInvoiceDto } from "./dto";

const MAX_LIMIT = 50;

// fallow-ignore-file code-duplication -- invoice and receipt projections intentionally repeat small database read models for stable response contracts.
@Injectable()
export class InvoicesService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  async createInvoice(organizationId: string, input: CreateInvoiceDto) {
    const totals = this.getInvoiceTotals(input);
    this.validateInvoiceTotals(input, totals);

    return this.db.transaction(async (tx) => {
      const customerId = await this.resolveCustomerId(tx, organizationId, input.customerId);
      await this.validateProducts(
        tx,
        organizationId,
        input.items.map((item) => item.productId),
      );
      const number = await this.nextInvoiceNumber(tx, organizationId);

      const [created] = await tx
        .insert(invoice)
        .values({
          organizationId,
          contactId: customerId,
          invoiceNumber: number,
          status: "issued",
          subtotalKobo: totals.subtotalKobo,
          discountKobo: totals.discountKobo,
          taxKobo: totals.taxKobo,
          totalKobo: totals.totalKobo,
          currency: "NGN",
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          notes: input.notes,
        })
        .returning({ id: invoice.id });

      await tx.insert(invoiceItem).values(this.buildInvoiceItems(created.id, input.items));
      return getInvoiceDocument(tx, organizationId, created.id);
    });
  }

  private getInvoiceTotals(input: CreateInvoiceDto) {
    const subtotalKobo = input.items.reduce(
      (total, item) => total + item.quantity * item.unitPriceKobo,
      0,
    );
    const discountKobo = input.discountKobo ?? 0;
    const taxKobo = input.taxKobo ?? 0;

    return {
      subtotalKobo,
      discountKobo,
      taxKobo,
      totalKobo: subtotalKobo - discountKobo + taxKobo,
    };
  }

  private validateInvoiceTotals(
    input: CreateInvoiceDto,
    totals: ReturnType<InvoicesService["getInvoiceTotals"]>,
  ) {
    if (input.items.length === 0) {
      throw new BadRequestException("At least one invoice item is required.");
    }
    if (
      !Number.isSafeInteger(totals.subtotalKobo) ||
      totals.subtotalKobo > 2147483647 ||
      totals.totalKobo > 2147483647
    ) {
      throw new BadRequestException("Invoice exceeds the supported amount.");
    }
    if (totals.totalKobo <= 0) {
      throw new BadRequestException("Invoice total must be greater than zero.");
    }
    if (totals.discountKobo > totals.subtotalKobo) {
      throw new BadRequestException("Discount cannot exceed the subtotal.");
    }
  }

  async createFromSale(organizationId: string, saleId: string) {
    return this.db.transaction(async (tx) => {
      const [sale] = await tx
        .select({
          id: order.id,
          customerId: order.contactId,
          subtotalKobo: order.subtotalKobo,
          discountKobo: order.discountKobo,
          taxKobo: order.taxKobo,
          totalKobo: order.totalKobo,
          currency: order.currency,
          notes: order.notes,
        })
        .from(order)
        .where(and(eq(order.id, saleId), eq(order.organizationId, organizationId)))
        .limit(1);

      if (!sale) throw new NotFoundException("Sale not found.");

      const [existingInvoice] = await tx
        .select({ id: invoice.id })
        .from(invoice)
        .where(and(eq(invoice.organizationId, organizationId), eq(invoice.sourceSaleId, saleId)))
        .limit(1);

      if (existingInvoice)
        throw new BadRequestException("An invoice already exists for this sale.");

      const items = await tx
        .select({
          productId: orderItem.productId,
          productName: orderItem.productName,
          quantity: orderItem.quantity,
          unitPriceKobo: orderItem.unitPriceKobo,
          totalKobo: orderItem.totalKobo,
        })
        .from(orderItem)
        .where(eq(orderItem.orderId, saleId));

      if (items.length === 0) throw new BadRequestException("Sale has no items.");

      const number = await this.nextInvoiceNumber(tx, organizationId);
      const [created] = await tx
        .insert(invoice)
        .values({
          organizationId,
          contactId: sale.customerId,
          sourceSaleId: saleId,
          invoiceNumber: number,
          status: "issued",
          subtotalKobo: sale.subtotalKobo,
          discountKobo: sale.discountKobo,
          taxKobo: sale.taxKobo,
          totalKobo: sale.totalKobo,
          currency: sale.currency,
          notes: sale.notes,
        })
        .returning({ id: invoice.id });

      await tx.insert(invoiceItem).values(this.buildInvoiceItems(created.id, items));

      return getInvoiceDocument(tx, organizationId, created.id);
    });
  }

  async listInvoices(organizationId: string, limit = 20, offset = 0) {
    const rows = await this.db
      .select({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerId: contact.id,
        customer: contact.name,
        status: invoice.status,
        totalKobo: invoice.totalKobo,
        currency: invoice.currency,
        dueDate: invoice.dueDate,
        createdAt: invoice.createdAt,
      })
      .from(invoice)
      .leftJoin(contact, eq(invoice.contactId, contact.id))
      .where(eq(invoice.organizationId, organizationId))
      .orderBy(desc(invoice.createdAt))
      .limit(Math.min(Math.max(limit, 1), MAX_LIMIT))
      .offset(Math.max(0, offset));

    return rows;
  }

  async getInvoice(organizationId: string, invoiceId: string) {
    return getInvoiceDocument(this.db, organizationId, invoiceId);
  }

  private buildInvoiceItems(
    invoiceId: string,
    items: Array<{
      productId?: string | null;
      description?: string | null;
      productName?: string | null;
      quantity: number;
      unitPriceKobo: number;
      totalKobo?: number;
    }>,
  ) {
    return items.map((item) => {
      const { productName, description, totalKobo, ...values } = item;
      return {
        invoiceId,
        ...values,
        description: description ?? productName ?? "Item",
        totalKobo: totalKobo ?? item.quantity * item.unitPriceKobo,
      };
    });
  }

  private async resolveCustomerId(
    tx: Pick<DbHandle, "select">,
    organizationId: string,
    customerId?: string,
  ) {
    if (!customerId) return null;

    const [customer] = await tx
      .select({ id: contact.id })
      .from(contact)
      .where(and(eq(contact.id, customerId), eq(contact.organizationId, organizationId)))
      .limit(1);

    if (!customer) throw new NotFoundException("Customer not found.");
    return customer.id;
  }

  private async validateProducts(
    tx: Pick<DbHandle, "select">,
    organizationId: string,
    productIds: Array<string | undefined>,
  ) {
    const ids = [...new Set(productIds.filter((id): id is string => Boolean(id)))];
    for (const productId of ids) {
      const [row] = await tx
        .select({ id: product.id })
        .from(product)
        .where(and(eq(product.id, productId), eq(product.organizationId, organizationId)))
        .limit(1);
      if (!row) throw new NotFoundException("One or more products were not found.");
    }
  }

  private async nextInvoiceNumber(_tx: Pick<DbHandle, "select">, _organizationId: string) {
    const stamp = Date.now().toString(36).toUpperCase();
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `INV-${stamp}-${suffix}`;
  }
}
