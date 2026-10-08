import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, isNotNull } from "@nomidat/db";
import { payoutAccount } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { MAX_BPS, providerPercentageCharge } from "./payout.constants";
import { PaystackPlatformClient } from "./paystack-platform.client";

/**
 * A destination is resolved with the bank before it is saved: Paystack does not
 * reverse a payout to a wrong account, so an unverified one is a permanent loss.
 */
@Injectable()
export class PayoutAccountService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly paystack: PaystackPlatformClient,
  ) {}

  async get(organizationId: string) {
    const [row] = await this.db
      .select({
        id: payoutAccount.id,
        businessName: payoutAccount.businessName,
        bankCode: payoutAccount.bankCode,
        bankName: payoutAccount.bankName,
        accountNumber: payoutAccount.accountNumber,
        accountName: payoutAccount.accountName,
        platformFeeBps: payoutAccount.platformFeeBps,
        activatedAt: payoutAccount.activatedAt,
        updatedAt: payoutAccount.updatedAt,
      })
      .from(payoutAccount)
      .where(eq(payoutAccount.organizationId, organizationId))
      .limit(1);

    return row ?? null;
  }

  async getBanks(currency = "NGN") {
    return this.paystack.getBanks(currency);
  }

  /** Confirms ownership before anything is stored, so the UI can show the name. */
  async resolve(accountNumber: string, bankCode: string) {
    const digits = accountNumber.replace(/\D/g, "");
    if (digits.length < 10) {
      throw new BadRequestException("Enter a valid account number.");
    }
    return { accountName: await this.paystack.resolveAccount(digits, bankCode) };
  }

  /** The subaccount to attach to a payment, or a clear refusal if there is none. */
  async requireSubaccountCode(organizationId: string): Promise<string> {
    const [row] = await this.db
      .select({ subaccountCode: payoutAccount.subaccountCode })
      .from(payoutAccount)
      .where(
        and(
          eq(payoutAccount.organizationId, organizationId),
          // A half-configured destination must never be used to collect money.
          isNotNull(payoutAccount.activatedAt),
        ),
      )
      .limit(1);

    if (!row?.subaccountCode) {
      throw new BadRequestException(
        "This business has not set up a payout account, so it cannot take payments yet.",
      );
    }
    return row.subaccountCode;
  }

  /**
   * Saves a destination and registers it with Paystack as a subaccount.
   *
   * The account name is taken from the resolution, never from the request body,
   * so a caller cannot label an account something it is not. The existing platform
   * fee is preserved: editing a bank account should not quietly reset the
   * commercial terms.
   */
  async save(
    organizationId: string,
    input: { businessName: string; bankCode: string; bankName: string; accountNumber: string },
  ) {
    const accountNumber = input.accountNumber.replace(/\D/g, "");
    const businessName = input.businessName.trim();
    if (businessName.length === 0) {
      throw new BadRequestException("Enter the business name registered to that account.");
    }

    const accountName = await this.paystack.resolveAccount(accountNumber, input.bankCode);

    const [existing] = await this.db
      .select({ platformFeeBps: payoutAccount.platformFeeBps })
      .from(payoutAccount)
      .where(eq(payoutAccount.organizationId, organizationId))
      .limit(1);
    const platformFeeBps = existing?.platformFeeBps ?? 0;

    const subaccountCode = await this.paystack.createSubaccount({
      businessName,
      bankCode: input.bankCode,
      accountNumber,
      percentageCharge: providerPercentageCharge(platformFeeBps),
    });

    const now = new Date();
    const [saved] = await this.db
      .insert(payoutAccount)
      .values({
        organizationId,
        businessName,
        bankCode: input.bankCode,
        bankName: input.bankName,
        accountNumber,
        accountName,
        subaccountCode,
        platformFeeBps,
        activatedAt: now,
      })
      .onConflictDoUpdate({
        target: payoutAccount.organizationId,
        set: {
          businessName,
          bankCode: input.bankCode,
          bankName: input.bankName,
          accountNumber,
          accountName,
          subaccountCode,
          activatedAt: now,
          updatedAt: now,
        },
      })
      .returning({
        id: payoutAccount.id,
        accountName: payoutAccount.accountName,
        bankName: payoutAccount.bankName,
        accountNumber: payoutAccount.accountNumber,
        subaccountCode: payoutAccount.subaccountCode,
        platformFeeBps: payoutAccount.platformFeeBps,
        activatedAt: payoutAccount.activatedAt,
      });

    if (!saved) throw new NotFoundException("Payout account could not be saved.");
    return saved;
  }

  /**
   * The platform's agreed share of this tenant's sales, in basis points.
   *
   * Returns the configured platform default when the tenant has no payout account
   * yet, so a brand-new business is not accidentally charged nothing.
   */
  async getFeeBps(organizationId: string, fallbackBps = 0): Promise<number> {
    const [row] = await this.db
      .select({ fee: payoutAccount.platformFeeBps })
      .from(payoutAccount)
      .where(eq(payoutAccount.organizationId, organizationId))
      .limit(1);
    return row?.fee ?? fallbackBps;
  }

  /**
   * Sets the platform's share. Validated here rather than trusting the caller,
   * because an out-of-range value would be rejected by Paystack at collection
   * time — after the customer has already tried to pay.
   */
  async setFeeBps(organizationId: string, platformFeeBps: number) {
    if (!Number.isInteger(platformFeeBps) || platformFeeBps < 0 || platformFeeBps >= MAX_BPS) {
      throw new BadRequestException("Fee must be between 0% and just under 100%.");
    }

    const [updated] = await this.db
      .update(payoutAccount)
      .set({ platformFeeBps, updatedAt: new Date() })
      .where(eq(payoutAccount.organizationId, organizationId))
      .returning({ platformFeeBps: payoutAccount.platformFeeBps });

    if (!updated) throw new NotFoundException("Set up a payout account first.");
    return updated;
  }
}
