import { SalesPersistenceService } from "./sales-persistence.service";
import { SalesQueriesService } from "./sales-queries.service";
import { SalePricingService } from "./sale-pricing.service";
import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import type { OrderTotals } from "../money/types/money.type";
import { and, eq, sql } from "@nomidat/db";
import { order, payment } from "@nomidat/db/schema";
import { MoneyPolicyService } from "../money/money-policy.service";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { WebhookDispatchService } from "../engagement/webhook-dispatch.service";
import type { CreateSaleDto, RecordPaymentDto } from "./dto";
import type { SaleTotals } from "./types/sales.type";

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly queries: SalesQueriesService,
    private readonly persistence: SalesPersistenceService,
    private readonly pricing: SalePricingService,
    private readonly money: MoneyPolicyService,
    private readonly webhooks: WebhookDispatchService,
  ) {}

  async createSale(organizationId: string, userId: string | null, input: CreateSaleDto) {
    if (input.clientReference) {
      const replayedId = await this.persistence.getOrderIdByClientReference(
        organizationId,
        input.clientReference,
      );
      if (replayedId) return this.queries.getSale(organizationId, replayedId);
    }

    this.validateSaleInput(input);
    // Price and identity first: the caller states what was sold, the seam says what
    // it costs. Tax is not among the inputs, so there is no way to sell tax free.
    const lines = await this.pricing.priceLines(organizationId, input.items);
    const { currency, ...figures } = await this.money.orderTotals(
      organizationId,
      lines,
      input.discountMinor ?? 0,
    );
    const totals: SaleTotals = {
      ...figures,
      paymentAmountMinor: this.checkPaid(input, figures.totalMinor),
    };

    const sale = await this.db.transaction(async (tx) => {
      const created = await this.persistence.persistSale(
        tx,
        organizationId,
        userId,
        input,
        lines,
        totals,
        currency,
      );
      const stored = await this.queries.getSale(organizationId, created.id, tx);
      return { saleId: created.id, stored };
    });

    // Post-commit on purpose: the replay guard above already returned, so this
    // fires once per real sale, and a subscriber that is down must not be able
    // to fail a sale the books have already recorded.
    void this.webhooks
      .dispatch(organizationId, "sale.created", {
        saleId: sale.saleId,
        currency,
        totalMinor: sale.stored.totalMinor,
        clientReference: input.clientReference ?? null,
      })
      .catch((reason: unknown) =>
        this.logger.warn(`sale.created webhook not sent: ${String(reason)}`),
      );

    return sale.stored;
  }

  private validateSaleInput(input: CreateSaleDto) {
    if (input.items.length === 0) {
      throw new BadRequestException("At least one sale item is required.");
    }
  }

  /**
   * What the caller is handing over against what the Order is owed. The Order
   * total is the server's figure, so this can only ever underpay or match — never
   * overpay, which would book money that was never received.
   */
  private checkPaid(input: CreateSaleDto, totalMinor: OrderTotals["totalMinor"]): number {
    const paymentAmountMinor = input.paymentAmountMinor ?? 0;
    if (paymentAmountMinor > totalMinor) {
      throw new BadRequestException("Payment cannot exceed the sale total.");
    }
    return paymentAmountMinor;
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
      const paidMinor = sale.paidMinor;
      const balanceMinor = sale.totalMinor - paidMinor;

      if (input.amountMinor > balanceMinor) {
        throw new BadRequestException("Payment cannot exceed the outstanding balance.");
      }

      const now = new Date();
      await tx.insert(payment).values({
        organizationId,
        orderId: saleId,
        contactId: sale.customerId,
        amountMinor: input.amountMinor,
        currency: sale.currency,
        method: input.method ?? "cash",
        reference: input.reference,
        notes: input.notes,
        createdByUserId: userId,
        paidAt: now,
      });

      const nextPaidMinor = paidMinor + input.amountMinor;
      const [updated] = await tx
        .update(order)
        .set({
          status: nextPaidMinor === sale.totalMinor ? "paid" : "pending",
          paidAt: nextPaidMinor === sale.totalMinor ? now : null,
          paymentReference: input.reference ?? sale.paymentReference,
          updatedAt: now,
        })
        .where(and(eq(order.id, saleId), eq(order.organizationId, organizationId)))
        .returning();

      return {
        ...updated,
        paidMinor: nextPaidMinor,
        balanceMinor: updated.totalMinor - nextPaidMinor,
      };
    });
  }
}
