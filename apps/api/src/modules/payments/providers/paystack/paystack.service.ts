import { PaymentNotificationService } from "../../payment-notification.service";
import {
  Logger,
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PaymentLedgerService } from "../../payment-ledger.service";
import { PayoutAccountService } from "../../../payouts/payout-account.service";
import { BusinessProfileService } from "../../../business-profile/business-profile.service";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { and, eq, generateId, sum } from "@nomidat/db";
import { order, payment, paymentLink } from "@nomidat/db/schema";
import type { ApiEnv } from "../../../../common/config/env";
import { API_ENV } from "../../../../common/config/env.module";
import { DATABASE, type DbHandle } from "../../../../common/db/db.provider";
import { PAYSTACK_PROVIDER_CODE, isCustomerChosenAmountChannel } from "./paystack.constants";
import type { InitializePaystackPaymentDto } from "../../dto";
import type {
  PaystackApiResponse,
  PaystackChargeSuccessEvent,
  PaystackInitializeResponse,
  PaystackTransaction,
  PaystackWebhookRequest,
} from "./paystack.interface";

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
    private readonly payouts: PayoutAccountService,
  ) {}

  async initializePayment(organizationId: string, input: InitializePaystackPaymentDto) {
    const sale = await this.getSale(organizationId, input.orderId);
    const amountMinor = await this.getOutstandingAmount(organizationId, sale.id, sale.totalMinor);

    const reference = `PAY-${generateId()}`;
    const response = await this.request<PaystackInitializeResponse>(
      organizationId,
      "/transaction/initialize",
      {
        method: "POST",
        body: JSON.stringify({
          email: input.email,
          amount: amountMinor,
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
      provider: PAYSTACK_PROVIDER_CODE,
      orderId: sale.id,
      contactId: sale.contactId,
      amountMinor,
      currency: sale.currency,
      reference: response.data.reference,
      providerUrl: response.data.authorization_url,
      status: "pending",
    });

    return {
      reference: response.data.reference,
      authorizationUrl: response.data.authorization_url,
      accessCode: response.data.access_code,
      amountMinor,
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

  /**
   * The signature is checked before anything is written.
   *
   * The reference is read from the still-unverified body to pick the link, but a
   * failure there answers exactly like a bad signature, so it cannot be used to
   * probe which references or tenants exist.
   */
  async handleWebhook(webhook: PaystackWebhookRequest) {
    if (!this.isChargeSuccessEvent(webhook.body)) {
      return { received: true };
    }

    const reference = webhook.body.data.reference;

    // One platform key verifies every webhook, so the reference is only read to
    // find the link — never to choose a secret. That removes the per-tenant lookup
    // that previously let an unauthenticated caller probe which references existed.
    this.verifyWebhookSignature(webhook.signature, webhook.rawBody, this.platformKey());
    await this.applyTransaction(reference, webhook.body.data);
    return { received: true };
  }

  /**
   * The platform's share of this tenant's sales, in basis points.
   *
   * Not wrapped in a try/catch: if this read throws, every later write in the same
   * transaction throws too, so catching it would only turn a loud failure into a
   * silent under-charge.
   */
  private async platformFeeBpsFor(organizationId: string): Promise<number> {
    return this.payouts.getFeeBps(organizationId, this.env.PLATFORM_DEFAULT_FEE_BPS);
  }

  /**
   * The platform's Paystack secret. Fails loudly rather than falling back to a
   * tenant's key, because silently using a different merchant of record is how
   * money ends up in the wrong account.
   */
  private platformKey(): string {
    const key = this.env.PLATFORM_PAYSTACK_SECRET;
    if (!key) {
      throw new BadRequestException("Payments are not configured for this platform yet.");
    }
    return key;
  }

  private async getSale(organizationId: string, orderId: string) {
    const [sale] = await this.db
      .select()
      .from(order)
      .where(and(eq(order.organizationId, organizationId), eq(order.id, orderId)))
      .limit(1);
    if (!sale) throw new BadRequestException("Sale not found.");

    if (sale.status === "paid") throw new BadRequestException("Sale is already paid.");
    if (sale.currency !== "NGN")
      throw new BadRequestException("Paystack payments currently support NGN sales only.");

    return sale;
  }

  private async getOutstandingAmount(organizationId: string, orderId: string, totalMinor: number) {
    const [paid] = await this.db
      .select({ totalMinor: sum(payment.amountMinor) })
      .from(payment)
      .where(and(eq(payment.organizationId, organizationId), eq(payment.orderId, orderId)));

    const amountMinor = totalMinor - Number(paid?.totalMinor ?? 0);
    if (amountMinor <= 0) {
      throw new BadRequestException("Sale has no outstanding balance.");
    }

    return amountMinor;
  }

  private async applyTransaction(reference: string, transaction: PaystackTransaction) {
    const link = await this.ledger.getPaymentLink(reference);
    this.assertTransactionMatches(link, reference, transaction);

    if (transaction.status !== "success") {
      await this.markPaymentLinkStatus(reference, transaction.status);
      return;
    }

    // The tenant's own agreed share, so the platform fee is not invented here.
    const feeBps = await this.platformFeeBpsFor(link.organizationId);
    await this.ledger.createPayment(reference, transaction, feeBps);
    try {
      await this.notifications.createNotification(reference);
    } catch {
      new Logger("Paystack").warn({ event: "payment_notification_deferred", reference });
    }
  }

  /**
   * Checkout channels are initialised with an amount we set, so a mismatch is an
   * error and is refused — that is what stops someone paying ₦1 against a ₦500,000
   * invoice. Only a dedicated virtual account lets the customer choose the amount,
   * where a shortfall is a part payment. Currency is never negotiable.
   */
  private assertTransactionMatches(
    link: Awaited<ReturnType<PaymentLedgerService["getPaymentLink"]>>,
    reference: string,
    transaction: PaystackTransaction,
  ) {
    if (transaction.reference !== reference) {
      throw new BadRequestException("Paystack reference mismatch.");
    }

    if (transaction.currency !== link.currency) {
      throw new BadRequestException("Paystack payment currency mismatch.");
    }

    const amountMatches = transaction.amount === link.amountMinor;

    if (amountMatches) return;

    if (isCustomerChosenAmountChannel(transaction.channel)) {
      if (transaction.amount <= 0) {
        throw new BadRequestException("Paystack reported a non-positive transfer amount.");
      }
      // Underpayment against a transfer: applied for the amount that arrived, and
      // the order stays part-paid so the shortfall is still visible.
      return;
    }

    throw new BadRequestException("Paystack payment amount mismatch.");
  }

  private async markPaymentLinkStatus(reference: string, status: string) {
    await this.db
      .update(paymentLink)
      .set({ status, updatedAt: new Date() })
      .where(eq(paymentLink.reference, reference));
  }

  /**
   * One message for every failure mode. Distinguishing "no signature" from
   * "wrong signature" would still tell an unauthenticated caller that the lookup
   * succeeded and the reference exists, so the wording is deliberately uniform.
   */
  private verifyWebhookSignature(signature: string | undefined, rawBody: Buffer, secret: string) {
    const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
    const provided = Buffer.from(signature ?? "", "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");

    if (provided.length !== expectedBuffer.length || !timingSafeEqual(provided, expectedBuffer)) {
      throw new UnauthorizedException("Missing or invalid Paystack signature.");
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
    // The platform is the merchant of record: one key for every tenant, never a
    // per-business secret. Tenants settle through the platform wallet instead.
    headers.set("Authorization", `Bearer ${this.platformKey()}`);
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
