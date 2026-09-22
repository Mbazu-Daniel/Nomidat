import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, gte, sql, sum } from "@nomidat/db";
import { contact, order, orderItem, payment, product } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import type { CreateSaleDto, RecordPaymentDto } from "./dto";

const MAX_LIMIT = 50;

@Injectable()
export class SalesService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  async createSale(organizationId: string, userId: string | null, input: CreateSaleDto) {
    this.validateSaleInput(input);
    const discountKobo = input.discountKobo ?? 0;
    const taxKobo = input.taxKobo ?? 0;
    const subtotalKobo = input.items.reduce(
      (total, item) => total + (item.lineTotalKobo ?? item.quantity * item.unitPriceKobo),
      0,
    );
    const totalKobo = subtotalKobo - discountKobo + taxKobo;
    const paymentAmountKobo = input.paymentAmountKobo ?? 0;

    if (totalKobo <= 0) throw new BadRequestException("Sale total must be greater than zero.");
    if (paymentAmountKobo > totalKobo) {
      throw new BadRequestException("Payment cannot exceed the sale total.");
    }

    return this.db.db.transaction((tx) =>
      this.persistSale(tx, organizationId, userId, input, {
        subtotalKobo,
        discountKobo,
        taxKobo,
        totalKobo,
        paymentAmountKobo,
      }),
    );
  }

  private validateSaleInput(input: CreateSaleDto) {
    if (input.items.length === 0) {
      throw new BadRequestException("At least one sale item is required.");
    }
    if (input.items.some((item) => !item.productId && !item.productName)) {
      throw new BadRequestException("Each sale item needs a productId or productName.");
    }
  }

  private async persistSale(
    tx: Pick<DbHandle["db"], "select" | "insert" | "update">,
    organizationId: string,
    userId: string | null,
    input: CreateSaleDto,
    totals: {
      subtotalKobo: number;
      discountKobo: number;
      taxKobo: number;
      totalKobo: number;
      paymentAmountKobo: number;
    },
  ) {
    const customerId = await this.resolveCustomerId(tx, organizationId, input.customerId);
    const resolvedItems = await this.resolveSaleItems(tx, organizationId, input.items);
    const now = new Date();

    const [createdOrder] = await tx
      .insert(order)
      .values({
        organizationId,
        contactId: customerId,
        status: totals.paymentAmountKobo === totals.totalKobo ? "paid" : "pending",
        subtotalKobo: totals.subtotalKobo,
        discountKobo: totals.discountKobo,
        taxKobo: totals.taxKobo,
        totalKobo: totals.totalKobo,
        currency: "NGN",
        paidAt: totals.paymentAmountKobo === totals.totalKobo ? now : null,
        paymentReference: input.paymentReference,
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await tx.insert(orderItem).values(
      resolvedItems.map((item) => ({
        orderId: createdOrder.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPriceKobo: item.unitPriceKobo,
        totalKobo: item.totalKobo,
      })),
    );

    if (totals.paymentAmountKobo > 0) {
      await tx.insert(payment).values({
        organizationId,
        orderId: createdOrder.id,
        contactId: customerId,
        amountKobo: totals.paymentAmountKobo,
        currency: "NGN",
        method: input.paymentMethod ?? "cash",
        reference: input.paymentReference,
        createdByUserId: userId,
        paidAt: now,
      });
    }

    return this.getSaleByIdTx(tx, organizationId, createdOrder.id);
  }

  private async resolveSaleItems(
    tx: Pick<DbHandle["db"], "select" | "update">,
    organizationId: string,
    items: CreateSaleDto["items"],
  ) {
    const resolvedItems: Array<{
      productId: string | null;
      productName: string;
      quantity: number;
      unitPriceKobo: number;
      totalKobo: number;
    }> = [];

    for (const item of items) {
      const productId = item.productId ?? null;
      let productName = item.productName ?? "Item";

      if (productId) {
        const [storedProduct] = await tx
          .select({
            id: product.id,
            name: product.name,
            isActive: product.isActive,
          })
          .from(product)
          .where(and(eq(product.id, productId), eq(product.organizationId, organizationId)))
          .limit(1);

        if (!storedProduct) throw new NotFoundException("Product not found.");
        if (!storedProduct.isActive) {
          throw new ConflictException("Product is archived and cannot be sold.");
        }

        productName = storedProduct.name;
        const [updatedProduct] = await tx
          .update(product)
          .set({
            stockQuantity: sql`${product.stockQuantity} - ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(product.id, productId),
              eq(product.organizationId, organizationId),
              gte(product.stockQuantity, item.quantity),
            ),
          )
          .returning({ id: product.id });

        if (!updatedProduct) {
          throw new ConflictException(
            "Insufficient stock for " +
              storedProduct.name +
              ". Available stock changed while recording this sale.",
          );
        }
      }

      resolvedItems.push({
        productId,
        productName,
        quantity: item.quantity,
        unitPriceKobo: item.unitPriceKobo,
        totalKobo: item.lineTotalKobo ?? item.quantity * item.unitPriceKobo,
      });
    }

    return resolvedItems;
  }

  async listSales(organizationId: string, limit = 20) {
    const rows = await this.db.db
      .select({
        id: order.id,
        customerId: contact.id,
        customer: contact.name,
        status: order.status,
        subtotalKobo: order.subtotalKobo,
        discountKobo: order.discountKobo,
        taxKobo: order.taxKobo,
        totalKobo: order.totalKobo,
        createdAt: order.createdAt,
      })
      .from(order)
      .leftJoin(contact, eq(order.contactId, contact.id))
      .where(eq(order.organizationId, organizationId))
      .orderBy(desc(order.createdAt))
      .limit(Math.min(Math.max(limit, 1), MAX_LIMIT));

    return Promise.all(
      rows.map(async (sale) => ({
        ...sale,
        paidKobo: await this.getPaidAmount(organizationId, sale.id),
      })),
    );
  }

  async getSale(organizationId: string, saleId: string) {
    return this.getSaleByIdTx(this.db.db, organizationId, saleId);
  }

  async recordPayment(
    organizationId: string,
    userId: string | null,
    saleId: string,
    input: RecordPaymentDto,
  ) {
    return this.db.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM ${order} WHERE id = ${saleId} AND organization_id = ${organizationId} FOR UPDATE`,
      );

      const sale = await this.getSaleByIdTx(tx, organizationId, saleId);
      const paidKobo = await this.getPaidAmountTx(tx, organizationId, saleId);
      const balanceKobo = sale.totalKobo - paidKobo;

      if (input.amountKobo > balanceKobo) {
        throw new BadRequestException("Payment cannot exceed the outstanding balance.");
      }

      const now = new Date();
      await tx.insert(payment).values({
        organizationId,
        orderId: saleId,
        contactId: sale.customerId,
        amountKobo: input.amountKobo,
        currency: sale.currency,
        method: input.method ?? "cash",
        reference: input.reference,
        notes: input.notes,
        createdByUserId: userId,
        paidAt: now,
      });

      const nextPaidKobo = paidKobo + input.amountKobo;
      const [updated] = await tx
        .update(order)
        .set({
          status: nextPaidKobo === sale.totalKobo ? "paid" : "pending",
          paidAt: nextPaidKobo === sale.totalKobo ? now : null,
          paymentReference: input.reference ?? sale.paymentReference,
          updatedAt: now,
        })
        .where(and(eq(order.id, saleId), eq(order.organizationId, organizationId)))
        .returning();

      return {
        ...updated,
        paidKobo: nextPaidKobo,
        balanceKobo: updated.totalKobo - nextPaidKobo,
      };
    });
  }

  async getCustomerBalance(organizationId: string, customerId: string) {
    const [customer] = await this.db.db
      .select({ id: contact.id, name: contact.name })
      .from(contact)
      .where(and(eq(contact.id, customerId), eq(contact.organizationId, organizationId)))
      .limit(1);

    if (!customer) throw new NotFoundException("Customer not found.");

    const pendingSales = await this.db.db
      .select({ id: order.id, totalKobo: order.totalKobo, createdAt: order.createdAt })
      .from(order)
      .where(
        and(
          eq(order.organizationId, organizationId),
          eq(order.contactId, customerId),
          eq(order.status, "pending"),
        ),
      )
      .orderBy(desc(order.createdAt));

    const balances = await Promise.all(
      pendingSales.map(async (sale) => ({
        ...sale,
        paidKobo: await this.getPaidAmount(organizationId, sale.id),
      })),
    );

    return {
      customer,
      outstandingKobo: Math.max(
        0,
        balances.reduce((total, sale) => total + sale.totalKobo - sale.paidKobo, 0),
      ),
      pendingSales: balances,
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

  private async getSaleByIdTx(
    tx: Pick<DbHandle["db"], "select">,
    organizationId: string,
    saleId: string,
  ) {
    const [sale] = await tx
      .select({
        id: order.id,
        customerId: contact.id,
        customer: contact.name,
        status: order.status,
        subtotalKobo: order.subtotalKobo,
        discountKobo: order.discountKobo,
        taxKobo: order.taxKobo,
        totalKobo: order.totalKobo,
        currency: order.currency,
        paidAt: order.paidAt,
        paymentReference: order.paymentReference,
        notes: order.notes,
        createdAt: order.createdAt,
      })
      .from(order)
      .leftJoin(contact, eq(order.contactId, contact.id))
      .where(and(eq(order.id, saleId), eq(order.organizationId, organizationId)))
      .limit(1);

    if (!sale) throw new NotFoundException("Sale not found.");

    const items = await tx
      .select({
        id: orderItem.id,
        productId: orderItem.productId,
        productName: orderItem.productName,
        quantity: orderItem.quantity,
        unitPriceKobo: orderItem.unitPriceKobo,
        totalKobo: orderItem.totalKobo,
      })
      .from(orderItem)
      .where(eq(orderItem.orderId, saleId));

    const payments = await tx
      .select({
        id: payment.id,
        amountKobo: payment.amountKobo,
        method: payment.method,
        reference: payment.reference,
        notes: payment.notes,
        paidAt: payment.paidAt,
      })
      .from(payment)
      .where(
        and(eq(payment.orderId, saleId), eq(payment.organizationId, organizationId)),
      )
      .orderBy(desc(payment.paidAt));

    const paidKobo = payments.reduce((total, item) => total + item.amountKobo, 0);

    return {
      ...sale,
      items,
      payments,
      paidKobo,
      balanceKobo: Math.max(0, sale.totalKobo - paidKobo),
    };
  }

  private async getPaidAmount(organizationId: string, saleId: string) {
    return this.getPaidAmountTx(this.db.db, organizationId, saleId);
  }

  private async getPaidAmountTx(
    tx: Pick<DbHandle["db"], "select">,
    organizationId: string,
    saleId: string,
  ) {
    const [result] = await tx
      .select({ totalKobo: sum(payment.amountKobo) })
      .from(payment)
      .where(and(eq(payment.organizationId, organizationId), eq(payment.orderId, saleId)));

    return Number(result?.totalKobo ?? 0);
  }
}
