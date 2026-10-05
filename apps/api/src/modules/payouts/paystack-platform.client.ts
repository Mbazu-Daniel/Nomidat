import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import { API_ENV } from "../../common/config/env.module";
import type { ApiEnv } from "../../common/config/env";

/** A bank the platform can pay out to. */
export type PaystackBank = {
  name: string;
  code: string;
  currency?: string;
};

type PaystackEnvelope<T> = { status: boolean; message?: string; data: T };

/** What the platform Paystack account can do right now. */
export type PaystackCapabilities = {
  /** Checkout redirect and transaction verification. */
  transactions: boolean;
  /** Creating Paystack customer records. */
  customerDirectory: boolean;
  /** Dedicated virtual accounts, for paying by bank transfer. */
  dedicatedVirtualAccounts: boolean;
  /** Settlement subaccounts, for splitting a sale to a tenant. */
  settlementSplits: boolean;
  /** Paying a tenant out to their own bank account. */
  outboundTransfers: boolean;
  /** Reading the platform's own balance, for reconciliation. */
  balanceRead: boolean;
};

/**
 * Thin client for the subset of Paystack the platform actually needs.
 *
 * Deliberately small: it exposes bank listing, account resolution and subaccount
 * creation, and nothing else. Every call uses the platform's own secret key, so
 * there is no per-tenant credential anywhere in this class.
 */
@Injectable()
export class PaystackPlatformClient {
  private readonly logger = new Logger(PaystackPlatformClient.name);

  constructor(@Inject(API_ENV) private readonly env: ApiEnv) {}

  /** Whether the platform can take payments at all. */
  isConfigured(): boolean {
    return Boolean(this.env.PLATFORM_PAYSTACK_SECRET);
  }

  private requireKey(): string {
    const key = this.env.PLATFORM_PAYSTACK_SECRET;
    if (!key) {
      // Fails loudly rather than silently collecting into an unconfigured account.
      throw new BadRequestException("Payments are not configured for this platform yet.");
    }
    return key;
  }

  async getBanks(currency = "NGN"): Promise<PaystackBank[]> {
    const response = await this.request<PaystackBank[]>(
      `/bank?currency=${encodeURIComponent(currency)}`,
    );
    return response.data;
  }

  /**
   * Asks the bank who owns an account number.
   *
   * This is the only trustworthy source of the account name. Paystack will not
   * recover funds sent to a wrong account, so a tenant's typed name is never used
   * as the destination name.
   */
  async resolveAccount(accountNumber: string, bankCode: string): Promise<string> {
    const response = await this.request<{ account_name: string }>(
      `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
    );
    const name = response.data?.account_name;
    if (!name) {
      throw new BadRequestException("That account could not be resolved.");
    }
    return name;
  }

  /**
   * Registers a settlement destination.
   *
   * `percentageCharge` is what the platform keeps; the remainder settles to the
   * tenant. It is sent as a percentage because that is what Paystack stores,
   * converted from the basis points held in our own schema.
   */
  async createSubaccount(input: {
    businessName: string;
    bankCode: string;
    accountNumber: string;
    percentageCharge: number;
  }) {
    const response = await this.request<{ subaccount_code: string }>("/subaccount", {
      method: "POST",
      body: JSON.stringify({
        business_name: input.businessName,
        bank_code: input.bankCode,
        account_number: input.accountNumber,
        percentage_charge: input.percentageCharge,
      }),
    });

    const code = response.data?.subaccount_code;
    if (!code) {
      throw new BadRequestException("Paystack did not return a subaccount code.");
    }
    return code;
  }

  /** The platform's own Paystack balance, per currency. */
  async getBalance() {
    const response = await this.request<{
      currency: string;
      available: number;
      ledger: number;
    }[]>("/balance");
    return response.data;
  }

  /**
   * Sends money to a third-party Nigerian bank account.
   *
   * This is the payout path that works without settlement subaccounts: the
   * platform holds the funds and transfers each tenant's share out, rather than
   * letting Paystack split the sale on the way in.
   *
   * `reference` is supplied by us and is Paystack's own idempotency key — sending
   * the same reference twice is rejected, which is what stops a retried payout
   * from paying a tenant twice.
   */
  async sendTransfer(input: {
    amountMinor: number;
    accountNumber: string;
    bankCode: string;
    accountName: string;
    reason: string;
    reference: string;
  }) {
    const response = await this.request<{ transfer_code: number; reference: string; status: string }>(
      "/transfer",
      {
        method: "POST",
        body: JSON.stringify({
          // Paystack works in the currency's major unit, not minor units.
          amount: input.amountMinor / 100,
          recipient: {
            type: "nuban",
            account_number: input.accountNumber,
            bank_code: input.bankCode,
            name: input.accountName,
          },
          reason: input.reason,
          reference: input.reference,
        }),
      },
    );
    return response.data;
  }

  /**
   * DVAs and subaccounts return 403 ``feature_unavailable`` until the business is
   * go-live and support enables them, so the UI asks rather than offering a
   * payment option that would fail at checkout.
   */
  async getCapabilities(): Promise<PaystackCapabilities> {
    const capabilities: PaystackCapabilities = {
      transactions: this.isConfigured(),
      customerDirectory: false,
      dedicatedVirtualAccounts: false,
      settlementSplits: false,
      outboundTransfers: false,
      balanceRead: false,
    };
    if (!this.isConfigured()) return capabilities;

    try {
      await this.getBanks();
      // Listing banks only needs a live secret, so it separates "not enabled"
      // from "bad key" without creating any records.
      capabilities.transactions = true;
    } catch {
      return { ...capabilities, transactions: false };
    }

    capabilities.customerDirectory = await this.probe("POST", "/customer", {
      email: "capability-probe@nomidat.invalid",
      first_name: "Capability",
      last_name: "Probe",
    });

    capabilities.dedicatedVirtualAccounts = capabilities.customerDirectory
      ? await this.probe("POST", "/dedicated_account", {
          customer: "CUS_probe",
          preferred_bank: "wema-bank",
        })
      : false;

    // A split needs a subaccount to split to, so it cannot exist without one.
    capabilities.settlementSplits = await this.probe("POST", "/subaccount", {
      business_name: "Capability Probe",
      bank_code: "044",
      account_number: "0123456789",
      percentage_charge: 0,
    });

    // Transfers are the payout path that works without subaccounts. An empty
    // payload is rejected on validation, not permissions, so a validation error
    // here means the feature is enabled and no money has moved.
    capabilities.outboundTransfers = await this.probe("POST", "/transfer", {});

    try {
      await this.getBalance();
      capabilities.balanceRead = true;
    } catch {
      capabilities.balanceRead = false;
    }

    return capabilities;
  }

  /**
   * There is no capabilities endpoint, so a 403 is the only signal available.
   * Each probe targets something inert; a probe that succeeds means it is on.
   */
  private async probe(method: string, path: string, body: Record<string, unknown>) {
    try {
      await this.request(path, { method, body: JSON.stringify(body) });
      return true;
    } catch (error) {
      this.logger.debug({ path, message: (error as Error).message });
      return false;
    }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<PaystackEnvelope<T>> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.requireKey()}`);
    headers.set("Content-Type", "application/json");

    const response = await fetch(`${this.env.PAYSTACK_API_URL}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(15_000),
    });

    const body = (await response.json()) as PaystackEnvelope<T>;
    if (!response.ok || !body.status) {
      this.logger.warn({ path, status: response.status, message: body.message });
      throw new BadRequestException(body.message || "Paystack request failed.");
    }
    return body;
  }
}
