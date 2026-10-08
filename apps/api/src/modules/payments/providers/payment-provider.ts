/**
 * The seam a payment provider sits behind. Adding Monnify, Nomba, Noah or Polar
 * means implementing this interface and registering it — no caller changes.
 */
export interface PaymentProvider {
  /** Stable code stored on a payment row, e.g. "paystack". */
  readonly code: string;
  readonly displayName: string;
  /** What this provider can actually do, so the UI never offers an unsupported option. */
  readonly capabilities: PaymentCapabilities;
  /** Currencies this provider settles in. */
  readonly supportedCurrencies: readonly string[];

  /** Starts a payment and returns what the caller should send the customer to. */
  createPaymentSession(input: CreatePaymentInput): Promise<PaymentSession>;
  /** Confirms a payment that the customer claims to have made. */
  verifyPayment(input: VerifyPaymentInput): Promise<VerifiedPayment>;
}

export interface PaymentCapabilities {
  /** One-off charges only; false for providers that can only do recurring billing. */
  readonly oneTime: boolean;
  readonly bankTransfer: boolean;
  readonly card: boolean;
  /** Provider collects the money; false when the merchant settles directly. */
  readonly hostedCheckout: boolean;
}

export interface CreatePaymentInput {
  orderId: string;
  organizationId: string;
  amountMinor: number;
  currency: string;
  customerEmail: string;
  returnUrl?: string;
}

export interface PaymentSession {
  /** Where to send the customer. Absent for providers that return a transfer reference. */
  redirectUrl?: string;
  /** Bank transfer instructions, when the provider settles by transfer. */
  transferInstructions?: { accountNumber: string; bankName: string; amountMinor: number };
}

export interface VerifyPaymentInput {
  organizationId: string;
  reference: string;
  amountMinor: number;
}

export interface VerifiedPayment {
  status: PaymentVerificationStatus;
  /** The provider's own id, stored so a later webhook can be matched to it. */
  providerReference: string;
  settledAt?: Date;
}

export const PaymentVerificationStatus = {
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  PENDING: "pending",
} as const;
export type PaymentVerificationStatus =
  (typeof PaymentVerificationStatus)[keyof typeof PaymentVerificationStatus];
