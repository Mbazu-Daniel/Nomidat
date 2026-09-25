import { PaymentNotificationService } from "../../payment-notification.service";
import {
  Logger,
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PaymentLedgerService } from "../../payment-ledger.service";
import { BusinessProfileService } from "../../../business-profile/business-profile.service";
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
    private readonly profiles: BusinessProfileService,
    private readonly ledger: PaymentLedgerService,
    private readonly notifications: PaymentNotificationService,
  ) {}

  async initializePayment(organizationId: string, input: InitializePaystackPaymentDto) {
    const sale = await this.getSale(organizationId, input.orderId);
    const amountKobo = await this.getOutstandingAmount(organizationId, sale.id, sale.totalKobo);

    const reference = `PAY-${generateId()}`;
    const response = await this.request<PaystackInitializeResponse>(
      organizationId,
      "/transaction/initialize",
      {
        method: "POST",
        body: JSON.stringify({
          email: input.email,
          amount: amountKobo,
          currency: sale.currency,
          reference,
          callback_url: input.callbackUrl ?? this.env.PAYSTACK_CALLBACK_URL,
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
    const link = await this.ledger.getPaymentLink(reference);
    if (link.organizationId !== organizationId) throw new BadRequestException("Payment not found.");

    const response = await this.request<PaystackTransaction>(
      organizationId,
      `/transaction/verify/${encodeURIComponent(reference)}`,
      { method: "GET" },
    );

    await this.applyTransaction(reference, response.data);
    return response.data;
  }

  async handleWebhook(webhook: PaystackWebhookRequest) {
    if (!this.isChargeSuccessEvent(webhook.body)) {
      return { received: true };
    }

    const link = await this.ledger.getPaymentLink(webhook.body.data.reference);
    const secret = await this.profiles.getPaymentKey(link.organizationId);
    this.verifyWebhookSignature(webhook.signature, webhook.rawBody, secret);
    await this.applyTransaction(webhook.body.data.reference, webhook.body.data);
    return { received: true };
  }

  private async getSale(organizationId: string, orderId: string) {
    const [sale] = await this.db
      .select()
      .from(order)
      .where(and(eq(order.organizationId, organizationId), eq(order.id, orderId)))
      .limit(1);
    if (!sale) throw new BadRequestException("Sale not found.");

    if (sale.status === "paid") {
      throw new BadRequestException("Sale is already paid.");
    }
    if (sale.currency !== "NGN") {
      throw new BadRequestException("Paystack payments currently support NGN sales only.");
    }

    return sale;
  }

  private async getOutstandingAmount(organizationId: string, orderId: string, totalKobo: number) {
    const [paid] = await this.db
      .select({ totalKobo: sum(payment.amountKobo) })
      .from(payment)
      .where(and(eq(payment.organizationId, organizationId), eq(payment.orderId, orderId)));

    const amountKobo = totalKobo - Number(paid?.totalKobo ?? 0);
    if (amountKobo <= 0) {
      throw new BadRequestException("Sale has no outstanding balance.");
    }

    return amountKobo;
  }

  private async applyTransaction(reference: string, transaction: PaystackTransaction) {
    const link = await this.ledger.getPaymentLink(reference);
    this.assertTransactionMatches(link, reference, transaction);

    if (transaction.status !== "success") {
      await this.markPaymentLinkStatus(reference, transaction.status);
      return;
    }

    await this.ledger.createPayment(reference, transaction);
    try {
      await this.notifications.createNotification(reference);
    } catch {
      new Logger("Paystack").warn({ event: "payment_notification_deferred", reference });
    }
  }

  private assertTransactionMatches(
    link: Awaited<ReturnType<PaymentLedgerService["getPaymentLink"]>>,
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
      throw new BadRequestException("Paystack payment amount or currency mismatch.");
    }
  }

  private async markPaymentLinkStatus(reference: string, status: string) {
    await this.db
      .update(paymentLink)
      .set({ status, updatedAt: new Date() })
      .where(eq(paymentLink.reference, reference));
  }

  private verifyWebhookSignature(signature: string | undefined, rawBody: Buffer, secret: string) {
    if (!signature) {
      throw new UnauthorizedException("Missing Paystack signature.");
    }

    const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
    const provided = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");

    if (provided.length !== expectedBuffer.length || !timingSafeEqual(provided, expectedBuffer)) {
      throw new UnauthorizedException("Invalid Paystack signature.");
    }
  }

  private isChargeSuccessEvent(event: unknown): event is PaystackChargeSuccessEvent {
    if (!this.isRecord(event) || event.event !== "charge.success") return false;
    return this.isValidTransaction(event.data);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private isValidTransaction(data: unknown): data is PaystackTransaction {
    return paystackTransactionSchema.safeParse(data).success;
  }

  private async request<T>(organizationId: string, path: string, init: RequestInit) {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${await this.profiles.getPaymentKey(organizationId)}`);
    headers.set("Content-Type", "application/json");

    const response = await fetch(`${this.env.PAYSTACK_API_URL}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await response.json()) as PaystackApiResponse<T>;

    if (!response.ok || !body.status) {
      throw new BadRequestException(body.message || "Paystack request failed.");
    }

    return body;
  }
}
