import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq } from "@nomidat/db";
import { contact, invoice, invoiceItem, order, orderItem, payment, product } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import type { CreateInvoiceDto } from "./dto";

const MAX_LIMIT = 50;

@Injectable()
export class InvoicesService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  async createInvoice(organizationId: string, input: CreateInvoiceDto) {
    if (input.items.length === 0) {
      throw new BadRequestException("At least one invoice item is required.");
    }

    const subtotalKobo = input.items.reduce(
      (total, item) => total + item.quantity * item.unitPriceKobo,
      0,
    );
    const discountKobo = input.discountKobo ?? 0;
    const taxKobo = input.taxKobo ?? 0;
    const totalKobo = subtotalKobo - discountKobo + taxKobo;

    if (totalKobo <= 0) throw new BadRequestException("Invoice total must be greater than zero.");
    if (discountKobo > subtotalKobo) {
      throw new BadRequestException("Discount cannot exceed the subtotal.");
    }

    return this.db.db.transaction(async (tx) => {
      const customerId = await this.resolveCustomerId(tx, organizationId, input.customerId);
      await this.validateProducts(tx, organizationId, input.items.map((item) => item.productId));
      const number = await this.nextInvoiceNumber(tx, organizationId);

      const [created] = await tx
        .insert(invoice)
        .values({
          organizationId,
          contactId: customerId,
          invoiceNumber: number,
          status: "issued",
          subtotalKobo,
          discountKobo,
          taxKobo,
          totalKobo,
          currency: "NGN",
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          notes: input.notes,
        })
        .returning({ id: invoice.id });

      await tx.insert(invoiceItem).values(
        input.items.map((item) => ({
          invoiceId: created.id,
          productId: item.productId,
          description: item.description,
          quantity: item.quantity,
          unitPriceKobo: item.unitPriceKobo,
          totalKobo: item.quantity * item.unitPriceKobo,
        })),
      );

      return this.getInvoiceTx(tx, organizationId, created.id);
    });
  }

  async createFromSale(organizationId: string, saleId: string) {
    return this.db.db.transaction(async (tx) => {
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

      if (existingInvoice) throw new BadRequestException("An invoice already exists for this sale.");

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

      await tx.insert(invoiceItem).values(
        items.map((item) => ({
          invoiceId: created.id,
          productId: item.productId,
          description: item.productName,
          quantity: item.quantity,
          unitPriceKobo: item.unitPriceKobo,
          totalKobo: item.totalKobo ?? item.quantity * item.unitPriceKobo,
        })),
      );

      return this.getInvoiceTx(tx, organizationId, created.id);
    });
  }

  async listInvoices(organizationId: string, limit = 20) {
    const rows = await this.db.db
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
      .limit(Math.min(Math.max(limit, 1), MAX_LIMIT));

    return rows;
  }

  async getInvoice(organizationId: string, invoiceId: string) {
    return this.getInvoiceTx(this.db.db, organizationId, invoiceId);
  }

  async getReceipt(organizationId: string, saleId: string) {
    const [sale] = await this.db.db
      .select({
        id: order.id,
        customerId: contact.id,
        customer: contact.name,
        totalKobo: order.totalKobo,
        currency: order.currency,
        createdAt: order.createdAt,
      })
      .from(order)
      .leftJoin(contact, eq(order.contactId, contact.id))
      .where(and(eq(order.id, saleId), eq(order.organizationId, organizationId)))
      .limit(1);

    if (!sale) throw new NotFoundException("Sale not found.");

    const items = await this.db.db
      .select({
        id: orderItem.id,
        description: orderItem.productName,
        quantity: orderItem.quantity,
        unitPriceKobo: orderItem.unitPriceKobo,
        totalKobo: orderItem.totalKobo,
      })
      .from(orderItem)
      .where(eq(orderItem.orderId, saleId));

    const payments = await this.db.db
      .select({
        id: payment.id,
        amountKobo: payment.amountKobo,
        method: payment.method,
        reference: payment.reference,
        paidAt: payment.paidAt,
      })
      .from(payment)
      .where(and(eq(payment.orderId, saleId), eq(payment.organizationId, organizationId)))
      .orderBy(desc(payment.paidAt));

    const paidKobo = payments.reduce((total, item) => total + item.amountKobo, 0);

    return {
      receiptNumber: `RCPT-${sale.id.slice(0, 8).toUpperCase()}`,
      sale,
      items,
      payments,
      paidKobo,
      balanceKobo: Math.max(0, sale.totalKobo - paidKobo),
    };
  }

  private async resolveCustomerId(
    tx: Pick<DbHandle["db"], "select">,
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
    tx: Pick<DbHandle["db"], "select">,
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
  private async nextInvoiceNumber(
    _tx: Pick<DbHandle["db"], "select">,
    _organizationId: string,
  ) {
    const stamp = Date.now().toString(36).toUpperCase();
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `INV-${stamp}-${suffix}`;
  }

  private async getInvoiceTx(
    tx: Pick<DbHandle["db"], "select">,
    organizationId: string,
    invoiceId: string,
  ) {
    const [result] = await tx
      .select({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerId: contact.id,
        customer: contact.name,
        status: invoice.status,
        subtotalKobo: invoice.subtotalKobo,
        discountKobo: invoice.discountKobo,
        taxKobo: invoice.taxKobo,
        totalKobo: invoice.totalKobo,
        currency: invoice.currency,
        dueDate: invoice.dueDate,
        paidAt: invoice.paidAt,
        pdfUrl: invoice.pdfUrl,
        notes: invoice.notes,
        createdAt: invoice.createdAt,
      })
      .from(invoice)
      .leftJoin(contact, eq(invoice.contactId, contact.id))
      .where(and(eq(invoice.id, invoiceId), eq(invoice.organizationId, organizationId)))
      .limit(1);

    if (!result) throw new NotFoundException("Invoice not found.");

    const items = await tx
      .select({
        id: invoiceItem.id,
        productId: invoiceItem.productId,
        description: invoiceItem.description,
        quantity: invoiceItem.quantity,
        unitPriceKobo: invoiceItem.unitPriceKobo,
        totalKobo: invoiceItem.totalKobo,
      })
      .from(invoiceItem)
      .where(eq(invoiceItem.invoiceId, invoiceId));

    return { ...result, items };
  }
}
