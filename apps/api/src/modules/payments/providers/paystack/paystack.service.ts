import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { and, eq, sum } from "@nomidat/db";
import { generateId } from "@nomidat/db";
import { order, payment, paymentLink } from "@nomidat/db/schema";
import type { ApiEnv } from "../../../../common/config/env";
import { API_ENV } from "../../../../common/config/env.module";
import { DATABASE, type DbHandle } from "../../../../common/db/db.provider";
import type { InitializePaystackPaymentDto } from "../../dto";
import type {
  PaystackApiResponse,
  PaystackChargeSuccessEvent,
  PaystackInitializeResponse,
  PaystackTransaction,
  PaystackWebhookRequest,
} from "./paystack.interface";

const PAYSTACK_PAYMENT_METHOD = "paystack";

const paystackTransactionSchema = z.object({
  id: z.number().int().positive(),
  status: z.string().min(1),
  reference: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.string().min(1),
  paid_at: z.string().nullable(),
  channel: z.string().nullable(),
});

@Injectable()
export class PaystackService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  async initializePayment(
    organizationId: string,
    input: InitializePaystackPaymentDto,
  ) {
    const sale = await this.getSale(organizationId, input.orderId);
    const amountKobo = await this.getOutstandingAmount(
      organizationId,
      sale.id,
      sale.totalKobo,
    );

    const reference = `PAY-${generateId()}`;
    const response = await this.request<PaystackInitializeResponse>(
      "/transaction/initialize",
      {
        method: "POST",
        body: JSON.stringify({
          email: input.email,
          amount: amountKobo,
          currency: sale.currency,
          reference,
          callback_url:
            input.callbackUrl ?? this.env.PAYSTACK_CALLBACK_URL,
          channels: input.channels,
          metadata: JSON.stringify({
            organizationId,
            orderId: sale.id,
            contactId: sale.contactId,
          }),
        }),
      },
    );

    await this.db.insert(paymentLink).values({
      organizationId,
      provider: PAYSTACK_PAYMENT_METHOD,
      orderId: sale.id,
      contactId: sale.contactId,
      amountKobo,
      currency: sale.currency,
      reference: response.data.reference,
      providerUrl: response.data.authorization_url,
      status: "pending",
    });

    return {
      reference: response.data.reference,
      authorizationUrl: response.data.authorization_url,
      accessCode: response.data.access_code,
      amountKobo,
      currency: sale.currency,
    };
  }

  async verifyPayment(organizationId: string, reference: string) {
    const link = await this.getPaymentLink(reference);
    this.assertOrganization(link.organizationId, organizationId);

    const response = await this.request<PaystackTransaction>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
      { method: "GET" },
    );

    await this.applyTransaction(reference, response.data);
    return response.data;
  }

  async handleWebhook(webhook: PaystackWebhookRequest) {
    this.verifyWebhookSignature(webhook.signature, webhook.rawBody);

    if (!this.isChargeSuccessEvent(webhook.body)) {
      return { received: true };
    }

    await this.applyTransaction(webhook.body.data.reference, webhook.body.data);
    return { received: true };
  }

  private async getSale(organizationId: string, orderId: string) {
    const sale = await this.findOrder(
      this.db,
      organizationId,
      orderId,
    );

    if (!sale) throw new BadRequestException("Sale not found.");
    if (sale.status === "paid") {
      throw new BadRequestException("Sale is already paid.");
    }
    if (sale.currency !== "NGN") {
      throw new BadRequestException(
        "Paystack payments currently support NGN sales only.",
      );
    }

    return sale;
  }

  private async getOutstandingAmount(
    organizationId: string,
    orderId: string,
    totalKobo: number,
  ) {
    const [paid] = await this.db
      .select({ totalKobo: sum(payment.amountKobo) })
      .from(payment)
      .where(
        and(
          eq(payment.organizationId, organizationId),
          eq(payment.orderId, orderId),
        ),
      );

    const amountKobo = totalKobo - Number(paid?.totalKobo ?? 0);
    if (amountKobo <= 0) {
      throw new BadRequestException("Sale has no outstanding balance.");
    }

    return amountKobo;
  }

  private async applyTransaction(
    reference: string,
    transaction: PaystackTransaction,
  ) {
    const link = await this.getPaymentLink(reference);
    this.assertTransactionMatches(link, reference, transaction);

    if (transaction.status !== "success") {
      await this.markPaymentLinkStatus(reference, transaction.status);
      return;
    }

    await this.recordSuccessfulPayment(reference, transaction);
  }

  private assertTransactionMatches(
    link: Awaited<ReturnType<PaystackService["getPaymentLink"]>>,
    reference: string,
    transaction: PaystackTransaction,
  ) {
    const referenceMatches = transaction.reference === reference;
    const amountMatches = transaction.amount === link.amountKobo;
    const currencyMatches = transaction.currency === link.currency;

    if (!referenceMatches) {
      throw new BadRequestException("Paystack reference mismatch.");
    }

    if (!amountMatches || !currencyMatches) {
      throw new BadRequestException(
        "Paystack payment amount or currency mismatch.",
      );
    }
  }

  private async markPaymentLinkStatus(reference: string, status: string) {
    await this.db
      .update(paymentLink)
      .set({ status, updatedAt: new Date() })
      .where(eq(paymentLink.reference, reference));
  }

  private async recordSuccessfulPayment(
    reference: string,
    transaction: PaystackTransaction,
  ) {
    await this.db.transaction((tx) =>
      this.persistSuccessfulPayment(tx, reference, transaction),
    );
  }

  private async persistSuccessfulPayment(
    tx: Parameters<Parameters<DbHandle["transaction"]>[0]>[0],
    reference: string,
    transaction: PaystackTransaction,
  ) {
    const currentLink = await this.getPaymentLinkForTransaction(tx, reference);
    if (currentLink.status === "paid") return;

    if (!currentLink.orderId) {
      throw new BadRequestException("Payment link is not attached to a sale.");
    }

    const now = transaction.paid_at ? new Date(transaction.paid_at) : new Date();

    await this.ensurePaymentRecorded(tx, currentLink, reference, transaction, now);

    const sale = await this.getOrderForPayment(
      tx,
      currentLink.organizationId,
      currentLink.orderId,
    );
    const paidKobo = await this.getOrderPaidAmount(
      tx,
      currentLink.organizationId,
      currentLink.orderId,
    );

    await this.updatePaidOrder(
      tx,
      currentLink,
      sale.totalKobo,
      paidKobo,
      reference,
      now,
    );
  }

  private async ensurePaymentRecorded(
    tx: Parameters<Parameters<DbHandle["transaction"]>[0]>[0],
    link: Awaited<ReturnType<PaystackService["getPaymentLink"]>>,
    reference: string,
    transaction: PaystackTransaction,
    paidAt: Date,
  ) {
    const existingPayment = await this.getPaymentByReference(
      tx,
      link.organizationId,
      reference,
    );
    if (existingPayment) return;

    await tx.insert(payment).values({
      organizationId: link.organizationId,
      orderId: link.orderId!,
      contactId: link.contactId,
      amountKobo: link.amountKobo,
      currency: link.currency,
      method: PAYSTACK_PAYMENT_METHOD,
      reference,
      notes: `Paystack transaction ${transaction.id}`,
      paidAt,
    });
  }

  private async updatePaidOrder(
    tx: Parameters<Parameters<DbHandle["transaction"]>[0]>[0],
    link: Awaited<ReturnType<PaystackService["getPaymentLink"]>>,
    totalKobo: number,
    paidKobo: number,
    reference: string,
    now: Date,
  ) {
    const isFullyPaid = paidKobo >= totalKobo;

    await tx
      .update(order)
      .set({
        status: isFullyPaid ? "paid" : "pending",
        paidAt: isFullyPaid ? now : null,
        paymentReference: reference,
        updatedAt: now,
      })
      .where(and(eq(order.id, link.orderId!), eq(order.organizationId, link.organizationId)));

    await tx
      .update(paymentLink)
      .set({ status: "paid", paidAt: now, updatedAt: now })
      .where(eq(paymentLink.reference, reference));
  }

  private async getPaymentLink(reference: string) {
    return this.findPaymentLink(this.db, reference);
  }

  private async getPaymentLinkForTransaction(
    tx: Parameters<Parameters<DbHandle["transaction"]>[0]>[0],
    reference: string,
  ) {
    return this.findPaymentLink(tx, reference);
  }

  private async findPaymentLink(
    db: DbHandle | Parameters<Parameters<DbHandle["transaction"]>[0]>[0],
    reference: string,
  ) {
    const [link] = await db
      .select({
        id: paymentLink.id,
        organizationId: paymentLink.organizationId,
        orderId: paymentLink.orderId,
        contactId: paymentLink.contactId,
        amountKobo: paymentLink.amountKobo,
        currency: paymentLink.currency,
        status: paymentLink.status,
      })
      .from(paymentLink)
      .where(eq(paymentLink.reference, reference))
      .limit(1);

    if (!link) throw new BadRequestException("Payment reference not found.");
    return link;
  }

  private async getPaymentByReference(
    tx: Parameters<Parameters<DbHandle["transaction"]>[0]>[0],
    organizationId: string,
    reference: string,
  ) {
    const [existingPayment] = await tx
      .select({ id: payment.id })
      .from(payment)
      .where(
        and(
          eq(payment.organizationId, organizationId),
          eq(payment.reference, reference),
        ),
      )
      .limit(1);

    return existingPayment;
  }

  private async getOrderForPayment(
    tx: Parameters<Parameters<DbHandle["transaction"]>[0]>[0],
    organizationId: string,
    orderId: string,
  ) {
    const sale = await this.findOrder(tx, organizationId, orderId);

    if (!sale) throw new BadRequestException("Sale not found.");
    return { totalKobo: sale.totalKobo };
  }

  private async findOrder(
    db: DbHandle | Parameters<Parameters<DbHandle["transaction"]>[0]>[0],
    organizationId: string,
    orderId: string,
  ) {
    const [sale] = await db
      .select({
        id: order.id,
        contactId: order.contactId,
        totalKobo: order.totalKobo,
        currency: order.currency,
        status: order.status,
      })
      .from(order)
      .where(and(eq(order.id, orderId), eq(order.organizationId, organizationId)))
      .limit(1);

    return sale;
  }

  private async getOrderPaidAmount(
    tx: Parameters<Parameters<DbHandle["transaction"]>[0]>[0],
    organizationId: string,
    orderId: string,
  ) {
    const [paid] = await tx
      .select({ totalKobo: sum(payment.amountKobo) })
      .from(payment)
      .where(and(eq(payment.organizationId, organizationId), eq(payment.orderId, orderId)));

    return Number(paid?.totalKobo ?? 0);
  }

  private assertOrganization(
    actualOrganizationId: string,
    expectedOrganizationId: string,
  ) {
    if (actualOrganizationId !== expectedOrganizationId) {
      throw new BadRequestException("Payment not found.");
    }
  }


  private verifyWebhookSignature(
    signature: string | undefined,
    rawBody: Buffer,
  ) {
    if (!signature) {
      throw new UnauthorizedException("Missing Paystack signature.");
    }

    const expected = createHmac("sha512", this.env.PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest("hex");
    const provided = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");

    if (
      provided.length !== expectedBuffer.length ||
      !timingSafeEqual(provided, expectedBuffer)
    ) {
      throw new UnauthorizedException("Invalid Paystack signature.");
    }
  }

  private isChargeSuccessEvent(
    event: unknown,
  ): event is PaystackChargeSuccessEvent {
    if (!this.isRecord(event) || event.event !== "charge.success") return false;
    return this.isValidTransaction(event.data);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private isValidTransaction(data: unknown): data is PaystackTransaction {
    return paystackTransactionSchema.safeParse(data).success;
  }

  private async request<T>(path: string, init: RequestInit) {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.env.PAYSTACK_SECRET_KEY}`);
    headers.set("Content-Type", "application/json");

    const response = await fetch(`${this.env.PAYSTACK_API_URL}${path}`, {
      ...init,
      headers,
    });
    const body = (await response.json()) as PaystackApiResponse<T>;

    if (!response.ok || !body.status) {
      throw new BadRequestException(
        body.message || "Paystack request failed.",
      );
    }

    return body;
  }
}
