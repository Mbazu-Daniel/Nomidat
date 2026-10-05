import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { BPS_PER_UNIT } from "./payout.constants";
import { DATABASE, type DbExecutor, type DbHandle } from "../../common/db/db.provider";
import { WalletRepository } from "./wallet.repository";

/** The movements that can appear in a wallet. Which way each one goes is the repository's call. */
export const WALLET_KINDS = ["credit", "debit", "withdrawal", "fee", "adjustment"] as const;
export type WalletKind = (typeof WALLET_KINDS)[number];

/**
 * The rules for a tenant's balance. Reads and writes live in WalletRepository;
 * what lives here is policy — what may be withdrawn, what a payment credits, and
 * what happens when a decision is reversed.
 */
@Injectable()
export class WalletService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly wallet: WalletRepository,
  ) {}

  async getBalance(organizationId: string) {
    return { balanceMinor: await this.wallet.findBalance(organizationId) };
  }

  getEntries(organizationId: string, limit = 50) {
    return this.wallet.findEntries(organizationId, limit);
  }

  getWithdrawalRequests(organizationId: string) {
    return this.wallet.findRequests(organizationId);
  }

  getWithdrawalRequest(organizationId: string, requestId: string) {
    return this.wallet.findRequest(organizationId, requestId);
  }

  async record(
    organizationId: string,
    input: {
      kind: WalletKind;
      amountMinor: number;
      currency?: string;
      reference?: string;
      description?: string;
    },
  ) {
    return this.db.transaction((tx) => this.recordIn(tx, organizationId, input));
  }

  /**
   * Appends a movement and returns the balance it leaves behind.
   *
   * The resulting balance is read back rather than recomputed here, because
   * `findBalance` is the one place that knows which way a `kind` travels. An
   * earlier version applied the sign in this file and summed the raw column in
   * the repository; the two disagreed, so a withdrawal raised the balance and
   * the overdraft guard below could not see it.
   */
  private async recordIn(
    tx: DbExecutor,
    organizationId: string,
    input: {
      kind: WalletKind;
      amountMinor: number;
      currency?: string;
      reference?: string;
      description?: string;
    },
  ): Promise<{ id: string; balanceAfterMinor: number }> {
    if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new BadRequestException("Enter an amount greater than zero.");
    }

    // Taken before the balance is read, so two movements cannot both read the
    // same starting point and overwrite one another's running total.
    await this.wallet.lockEntries(organizationId, tx);

    const created = await this.wallet.insertEntry(
      {
        organizationId,
        kind: input.kind,
        // Always stored positive; the kind carries the direction.
        amountMinor: input.amountMinor,
        currency: input.currency ?? "NGN",
        reference: input.reference ?? null,
        description: input.description ?? null,
        // Provisional; corrected once the row exists.
        balanceAfterMinor: 0,
      },
      tx,
    );
    // An earlier delivery of the same reference already took this entry.
    if (!created) throw new ConflictException("That entry is already recorded.");

    const balanceAfterMinor = await this.wallet.findBalance(organizationId, tx);
    // A tenant may never be overdrawn: the refusal and the movement roll back
    // together, so a refused withdrawal never reaches the ledger.
    if (balanceAfterMinor < 0) {
      throw new ConflictException("That is more than the available balance.");
    }
    await this.wallet.setBalanceOnEntry(created.id, balanceAfterMinor, tx);

    return { id: created.id, balanceAfterMinor };
  }

  /**
   * Credits a tenant for money that arrived, net of the platform fee.
   *
   * Pass `db` when the caller already holds a transaction, so the payment row and
   * the credit commit together. A payment recorded without its credit loses the
   * tenant that money silently.
   *
   * The fee is not a second row: the balance is the sum of the ledger, and a fee
   * entry would be a second movement to reason about. A redelivered webhook is
   * rejected by the unique index on (organization_id, reference).
   */
  async creditPayment(
    organizationId: string,
    input: {
      amountMinor: number;
      platformFeeBps: number;
      currency: string;
      reference: string;
      description?: string;
    },
    db: DbExecutor = this.db,
  ) {
    // Floor, so rounding the fee can never credit a minor unit more than arrived.
    // Divided by BPS_PER_UNIT, not BPS_PER_PERCENT: this is a fraction of the
    // amount, not the number Paystack's percentageCharge wants.
    const feeMinor = Math.floor((input.amountMinor * input.platformFeeBps) / BPS_PER_UNIT);
    const netMinor = input.amountMinor - feeMinor;
    if (netMinor < 0) {
      throw new BadRequestException("That payment is smaller than the platform fee.");
    }

    const explanation =
      feeMinor > 0
        ? `${input.description ?? "Payment received"} (${input.amountMinor} gross less ${feeMinor} platform fee)`
        : (input.description ?? "Payment received");

    const credit = async (executor: DbExecutor) => {
      await this.wallet.lockEntries(organizationId, executor);

      const created = await this.wallet.insertEntry(
        {
          organizationId,
          kind: "credit",
          amountMinor: netMinor,
          currency: input.currency,
          reference: input.reference,
          description: explanation,
          // Provisional; corrected once the credit is committed.
          balanceAfterMinor: 0,
        },
        executor,
      );
      // An earlier delivery of this webhook already took the reference.
      if (!created) return { credited: false, netMinor, feeMinor, balanceAfterMinor: null };

      const balanceAfterMinor = await this.wallet.findBalance(organizationId, executor);
      await this.wallet.setBalanceOnEntry(created.id, balanceAfterMinor, executor);
      return { credited: true, netMinor, feeMinor, balanceAfterMinor };
    };

    return db === this.db ? this.db.transaction((tx) => credit(tx)) : credit(db);
  }

  /**
   * Requests a withdrawal, reserving the funds by debiting the wallet immediately.
   *
   * Debited up front so a second request cannot spend the same balance while the
   * first transfer is in flight. The debit and the request are one transaction:
   * if the request cannot be written the reservation is released with it, rather
   * than leaving money debited against a request that does not exist.
   */
  async requestWithdrawal(
    organizationId: string,
    userId: string | null,
    input: {
      amountMinor: number;
      currency?: string;
      bankCode: string;
      bankName: string;
      accountNumber: string;
      accountName: string;
    },
  ) {
    return this.db.transaction(async (tx) => {
      const moved = await this.recordIn(tx, organizationId, {
        kind: "withdrawal",
        amountMinor: input.amountMinor,
        currency: input.currency,
        description: "Withdrawal requested",
      });

      const created = await this.wallet.insertPayoutRequest(
        {
          organizationId,
          amountMinor: input.amountMinor,
          currency: input.currency ?? "NGN",
          status: "requested",
          bankCode: input.bankCode,
          bankName: input.bankName,
          accountNumber: input.accountNumber,
          accountName: input.accountName,
          requestedByUserId: userId,
        },
        tx,
      );
      if (!created) throw new ConflictException("That withdrawal could not be recorded.");

      return { id: created.id, status: created.status, balanceAfterMinor: moved.balanceAfterMinor };
    });
  }

  /**
   * Marks a request as sent.
   *
   * Never refund automatically on failure: the transfer may have gone through, so
   * retry with the same reference instead.
   */
  async markSent(organizationId: string, requestId: string) {
    const row = await this.wallet.updatePayoutRequest(
      organizationId,
      requestId,
      "requested",
      { status: "sent" },
      this.db,
    );
    if (!row) throw new BadRequestException("That withdrawal is not awaiting a decision.");
    return row;
  }

  /**
   * Returns funds after a request is refused. The debit is reversed by a
   * compensating credit rather than by deleting the original row, so the refused
   * attempt stays visible in the history.
   *
   * The decision and the credit share one transaction, and the decision is a
   * compare-and-set on the status. Deciding and then crediting separately let two
   * concurrent refusals both decide to refund.
   */
  async refundRequest(organizationId: string, requestId: string, reason: string) {
    return this.db.transaction(async (tx) => {
      const request = await this.wallet.findRequest(organizationId, requestId);
      if (!request) throw new BadRequestException("Withdrawal request not found.");

      const updated = await this.wallet.updatePayoutRequest(
        organizationId,
        requestId,
        "requested",
        { status: "rejected", reason },
        tx,
      );
      if (!updated) {
        throw new ConflictException("That withdrawal has already been decided.");
      }

      return this.recordIn(tx, organizationId, {
        kind: "adjustment",
        amountMinor: request.amountMinor,
        currency: request.currency,
        reference: requestId,
        description: `Withdrawal declined: ${reason}`,
      });
    });
  }
}
