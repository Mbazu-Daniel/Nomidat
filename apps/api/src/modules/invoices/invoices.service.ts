import { getInvoiceDocument } from "./invoice-document-query";
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { and, desc, eq } from "@nomidat/db";
import { contact, invoice, invoiceItem, order, orderItem } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { WebhookDispatchService } from "../engagement/webhook-dispatch.service";
import { MoneyPolicyService } from "../money/money-policy.service";
import type { CreateInvoiceDto, UpdateInvoiceDto } from "./dto";
import { invoiceTotals, lockOpenInvoice, validateInvoiceTotals } from "./invoice-corrections";
import {
  buildInvoiceItems,
  nextInvoiceNumber,
  resolveCustomerId,
  validateProducts,
} from "./invoice-write";
import type { InvoiceDocument } from "./types";

const MAX_LIMIT = 50;

// fallow-ignore-file code-duplication -- invoice and receipt projections intentionally repeat small database read models for stable response contracts.
@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly money: MoneyPolicyService,
    private readonly webhooks: WebhookDispatchService,
  ) {}

  async createInvoice(organizationId: string, input: CreateInvoiceDto) {
    const totals = this.getInvoiceTotals(input);
    validateInvoiceTotals(totals, input.items.length);
    // The business's own currency, not a constant. An invoice raised in dollars
    // and printed as naira is wrong on the one document the customer pays from.
    const { currency } = await this.money.getPolicy(organizationId);

    const result = await this.db.transaction(async (tx) => {
      const customerId = await resolveCustomerId(tx, organizationId, input.customerId);
      await validateProducts(
        tx,
        organizationId,
        input.items.map((item) => item.productId),
      );
      const number = nextInvoiceNumber();

      const [created] = await tx
        .insert(invoice)
        .values({
          organizationId,
          contactId: customerId,
          invoiceNumber: number,
          status: "issued",
          subtotalMinor: totals.subtotalMinor,
          discountMinor: totals.discountMinor,
          taxMinor: totals.taxMinor,
          totalMinor: totals.totalMinor,
          currency,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          notes: input.notes,
        })
        .returning({ id: invoice.id });

      await tx.insert(invoiceItem).values(buildInvoiceItems(created.id, input.items));
      return {
        invoiceId: created.id,
        document: await getInvoiceDocument(tx, organizationId, created.id),
      };
    });

    this.emitCreated(organizationId, result.invoiceId, result.document);
    return result.document;
  }

  /**
   * Tells subscribers an invoice exists — after the insert has committed, and
   * without waiting for their receiver. A subscriber being down must not turn
   * into an invoice the seller saw fail.
   */
  private emitCreated(organizationId: string, invoiceId: string, document: InvoiceDocument) {
    void this.webhooks
      .dispatch(organizationId, "invoice.created", {
        invoiceId,
        invoiceNumber: document.invoiceNumber,
        currency: document.currency,
        totalMinor: document.totalMinor,
      })
      .catch((reason: unknown) =>
        this.logger.warn(`invoice.created webhook not sent: ${String(reason)}`),
      );
  }

  private getInvoiceTotals(input: CreateInvoiceDto) {
    const subtotalMinor = input.items.reduce(
      (total, item) => total + item.quantity * item.unitPriceMinor,
      0,
    );
    return invoiceTotals(subtotalMinor, input.discountMinor ?? 0, input.taxMinor ?? 0);
  }

  async createFromSale(organizationId: string, saleId: string) {
    const result = await this.db.transaction(async (tx) => {
      const [sale] = await tx
        .select({
          id: order.id,
          customerId: order.contactId,
          subtotalMinor: order.subtotalMinor,
          discountMinor: order.discountMinor,
          taxMinor: order.taxMinor,
          totalMinor: order.totalMinor,
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
          unitPriceMinor: orderItem.unitPriceMinor,
          totalMinor: orderItem.totalMinor,
        })
        .from(orderItem)
        .where(eq(orderItem.orderId, saleId));

      if (items.length === 0) throw new BadRequestException("Sale has no items.");

      const number = nextInvoiceNumber();
      const [created] = await tx
        .insert(invoice)
        .values({
          organizationId,
          contactId: sale.customerId,
          sourceSaleId: saleId,
          invoiceNumber: number,
          status: "issued",
          subtotalMinor: sale.subtotalMinor,
          discountMinor: sale.discountMinor,
          taxMinor: sale.taxMinor,
          totalMinor: sale.totalMinor,
          currency: sale.currency,
          notes: sale.notes,
        })
        .returning({ id: invoice.id });

      await tx.insert(invoiceItem).values(buildInvoiceItems(created.id, items));

      return {
        invoiceId: created.id,
        document: await getInvoiceDocument(tx, organizationId, created.id),
      };
    });

    this.emitCreated(organizationId, result.invoiceId, result.document);
    return result.document;
  }

  /**
   * Corrects an invoice that has already been raised.
   *
   * The status is read under a row lock rather than before the write: an invoice
   * marked paid while this request is in flight must still refuse, or the guard
   * is only as strong as the caller's timing. Only the fields that were sent are
   * written, so fixing a due date cannot quietly drop the notes.
   */
  async updateInvoice(organizationId: string, invoiceId: string, input: UpdateInvoiceDto) {
    return this.db.transaction(async (tx) => {
      const current = await lockOpenInvoice(tx, organizationId, invoiceId);

      // The lines are replaced whole, so the subtotal comes from what is being
      // written — never from a mixture of old lines and a newly typed discount.
      const subtotalMinor = input.items
        ? input.items.reduce((total, item) => total + item.quantity * item.unitPriceMinor, 0)
        : current.subtotalMinor;
      const totals = invoiceTotals(
        subtotalMinor,
        input.discountMinor ?? current.discountMinor,
        input.taxMinor ?? current.taxMinor,
      );
      // The count only guards against an empty invoice; when the lines are left
      // alone the stored ones stand, and they could not have been empty.
      validateInvoiceTotals(totals, input.items?.length ?? 1);

      const values: Partial<typeof invoice.$inferInsert> = { ...totals, updatedAt: new Date() };
      if (input.customerId !== undefined) {
        values.contactId = await resolveCustomerId(tx, organizationId, input.customerId);
      }
      if (input.dueDate !== undefined) {
        values.dueDate = input.dueDate ? new Date(input.dueDate) : null;
      }
      if (input.notes !== undefined) values.notes = input.notes;

      if (input.items) {
        await validateProducts(
          tx,
          organizationId,
          input.items.map((item) => item.productId),
        );
        // Replaced rather than patched line by line: an invoice's lines are an
        // order, and a set that is only half updated would still total.
        await tx.delete(invoiceItem).where(eq(invoiceItem.invoiceId, invoiceId));
        await tx.insert(invoiceItem).values(buildInvoiceItems(invoiceId, input.items));
      }

      await tx.update(invoice).set(values).where(eq(invoice.id, invoiceId));
      return getInvoiceDocument(tx, organizationId, invoiceId);
    });
  }

  /** Removes an invoice and, by cascade, its lines and any counter-offers on it. */
  async removeInvoice(organizationId: string, invoiceId: string) {
    return this.db.transaction(async (tx) => {
      await lockOpenInvoice(tx, organizationId, invoiceId);
      await tx.delete(invoice).where(eq(invoice.id, invoiceId));
      return { id: invoiceId, deleted: true };
    });
  }

  async getInvoices(organizationId: string, limit = 20, offset = 0) {
    const rows = await this.db
      .select({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerId: contact.id,
        customer: contact.name,
        status: invoice.status,
        totalMinor: invoice.totalMinor,
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
}
