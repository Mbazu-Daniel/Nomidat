import {
  PaymentVerificationStatus,
  type CreatePaymentInput,
  type PaymentCapabilities,
  type PaymentProvider,
  type PaymentSession,
  type VerifiedPayment,
  type VerifyPaymentInput,
} from "../payment-provider";
import { PaystackService } from "./paystack.service";
import { PAYSTACK_PROVIDER_CODE } from "./paystack.constants";
import { BadRequestException, Injectable } from "@nestjs/common";

function toVerificationStatus(status: string): PaymentVerificationStatus {
  if (status === "success") return PaymentVerificationStatus.SUCCEEDED;
  if (status === "failed") return PaymentVerificationStatus.FAILED;
  return PaymentVerificationStatus.PENDING;
}

/**
 * Adapts the existing Paystack service to the provider interface. The HTTP work
 * stays in PaystackService; this class only declares what Paystack can do, so the
 * registry can present it alongside future providers without changing callers.
 */
@Injectable()
export class PaystackProvider implements PaymentProvider {
  readonly code = PAYSTACK_PROVIDER_CODE;
  readonly displayName = "Paystack";

  readonly capabilities: PaymentCapabilities = {
    oneTime: true,
    bankTransfer: true,
    card: true,
    hostedCheckout: true,
  };

  readonly supportedCurrencies = ["NGN", "GHS", "ZAR", "USD", "KES"];

  constructor(private readonly paystack: PaystackService) {}

  async createPaymentSession(input: CreatePaymentInput): Promise<PaymentSession> {
    // Paystack derives the amount from the order and mints its own reference,
    // so neither is passed through. It also requires an email, so a session can
    // only be created for a customer who supplied one.
    if (!input.customerEmail) {
      throw new BadRequestException("A customer email is required to start a payment.");
    }

    const session = await this.paystack.initializePayment(input.organizationId, {
      orderId: input.orderId,
      email: input.customerEmail,
      callbackUrl: input.returnUrl,
    });

    return { redirectUrl: session.authorizationUrl };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifiedPayment> {
    const transaction = await this.paystack.verifyPayment(input.organizationId, input.reference);

    return {
      status: toVerificationStatus(transaction.status),
      providerReference: transaction.reference ?? input.reference,
      settledAt: transaction.paid_at ? new Date(transaction.paid_at) : undefined,
    };
  }
}
