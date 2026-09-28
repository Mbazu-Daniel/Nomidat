import { SalesQueriesService } from "./sales-queries.service";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, gte, sql } from "@nomidat/db";
import { contact, order, orderItem, payment, product } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import type { CreateSaleDto, RecordPaymentDto } from "./dto";

@Injectable()
export class SalesService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly queries: SalesQueriesService,
  ) {}

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

    if (
      !Number.isSafeInteger(subtotalKobo) ||
      subtotalKobo > 2147483647 ||
      totalKobo > 2147483647
    ) {
      throw new BadRequestException("Sale exceeds the supported amount.");
    }
    if (discountKobo > subtotalKobo)
      throw new BadRequestException("Discount cannot exceed the subtotal.");
    if (totalKobo <= 0) throw new BadRequestException("Sale total must be greater than zero.");
    if (paymentAmountKobo > totalKobo) {
      throw new BadRequestException("Payment cannot exceed the sale total.");
    }

    return this.db.transaction((tx) =>
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
    tx: Pick<DbHandle, "select" | "insert" | "update">,
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

    return this.queries.getSale(organizationId, createdOrder.id, tx);
  }

  private async resolveSaleItems(
    tx: Pick<DbHandle, "select" | "update">,
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

  async recordPayment(
    organizationId: string,
    userId: string | null,
    saleId: string,
    input: RecordPaymentDto,
  ) {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM ${order} WHERE id = ${saleId} AND organization_id = ${organizationId} FOR UPDATE`,
      );

      const sale = await this.queries.getSale(organizationId, saleId, tx);
      const paidKobo = sale.paidKobo;
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
}
