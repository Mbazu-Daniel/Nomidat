import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { extractHeaders } from "../../common/helpers/auth-http";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { BusinessAuthService } from "../business/business-auth.service";
import { PayoutAccountService } from "./payout-account.service";
import { PaystackPlatformClient } from "./paystack-platform.client";
import { assertCanManagePayouts } from "./payout-permissions";
import { RejectWithdrawalDto } from "./dto/reject-withdrawal.dto";
import { RequestWithdrawalDto } from "./dto/request-withdrawal.dto";
import { WalletService } from "./wallet.service";

@ApiTags("Payouts")
@Controller("organizations/:organizationId/wallet")
export class WalletController {
  constructor(
    private readonly auth: BusinessAuthService,
    private readonly wallet: WalletService,
    private readonly paystack: PaystackPlatformClient,
    private readonly accounts: PayoutAccountService,
  ) {}

  @Get()
  @ApiOperation({ summary: "This business's available balance" })
  async balance(@Param("organizationId") org: string, @Req() req: Request) {
    await this.read(req, org);
    return this.wallet.getBalance(org);
  }

  @Get("entries")
  @ApiQuery({ name: "limit", required: false })
  @ApiOperation({ summary: "Balance movements, newest first" })
  async entries(
    @Param("organizationId") org: string,
    @Req() req: Request,
    @Query("limit") limit?: string,
  ) {
    await this.read(req, org);
    return this.wallet.getEntries(org, limit ? Number(limit) : 50);
  }

  @Get("withdrawals")
  @ApiOperation({ summary: "Withdrawal requests" })
  async withdrawals(@Param("organizationId") org: string, @Req() req: Request) {
    await this.read(req, org);
    return this.wallet.getWithdrawalRequests(org);
  }

  /**
   * A tenant asks for money out. The destination is snapshotted from the verified
   * payout account rather than taken from the request, so a withdrawal cannot be
   * redirected by whoever happened to click the button.
   */
  @Post("withdrawals")
  @ApiOperation({
    summary: "Request a withdrawal to your bank account",
    description:
      "The funds are held back from your balance immediately. The transfer is sent afterwards and retried with the same reference if it fails.",
  })
  async withdraw(
    @Param("organizationId") org: string,
    @Body() body: RequestWithdrawalDto,
    @Req() req: Request,
  ) {
    const session = await this.managePayouts(req, org);

    const destination = await this.accounts.get(org);
    if (!destination) {
      throw new BadRequestException("Add a payout account before requesting a withdrawal.");
    }

    return this.wallet.requestWithdrawal(org, session.userId, {
      amountMinor: body.amountMinor,
      currency: body.currency,
      bankCode: destination.bankCode,
      bankName: destination.bankName,
      accountNumber: destination.accountNumber,
      accountName: destination.accountName,
    });
  }

  /**
   * Sends an approved withdrawal out to the tenant's bank.
   *
   * The reference is derived from the request id, so retrying after a timeout
   * cannot pay twice — Paystack rejects a duplicate reference.
   */
  @Post("withdrawals/:requestId/send")
  @ApiOperation({ summary: "Send an approved withdrawal to the bank" })
  async send(
    @Param("organizationId") org: string,
    @Param("requestId") requestId: string,
    @Req() req: Request,
  ) {
    await this.managePayouts(req, org);

    const request = await this.wallet.getWithdrawalRequest(org, requestId);
    if (!request) throw new NotFoundException("Withdrawal request not found.");
    if (request.status !== "requested") {
      throw new ConflictException("That withdrawal has already been decided.");
    }

    const result = await this.paystack.sendTransfer({
      amountMinor: request.amountMinor,
      accountNumber: request.accountNumber,
      bankCode: request.bankCode,
      accountName: request.accountName,
      reason: "Nomidat payout",
      reference: `payout-${request.id}`,
    });

    await this.wallet.markSent(org, requestId);
    return result;
  }

  /**
   * Declines a withdrawal and returns the funds to the balance.
   *
   * Without this a declined payout stays debited forever: the reservation is real
   * money held back, and nothing else can release it. The refusal and the credit
   * share one transaction, so a decision cannot be recorded without the money going
   * back — nor the money returned without the decision.
   */
  @Post("withdrawals/:requestId/reject")
  @ApiOperation({ summary: "Decline a withdrawal and return the funds" })
  async reject(
    @Param("organizationId") org: string,
    @Param("requestId") requestId: string,
    @Body() body: RejectWithdrawalDto,
    @Req() req: Request,
  ) {
    await this.managePayouts(req, org);

    const result = await this.wallet.refundRequest(org, requestId, body.reason);
    return { status: "rejected", balanceAfterMinor: result.balanceAfterMinor };
  }

  /**
   * Reads are open to any member. Anything that moves money is not: withdrawing,
   * sending and declining a transfer are owner/admin/manager only, so a read-only
   * or narrow-scope staff account cannot move the business's balance.
   */
  private async read(req: Request, org: string) {
    return this.auth.getSession(extractHeaders(req), org);
  }

  private async managePayouts(req: Request, org: string) {
    const session = await this.read(req, org);
    assertCanManagePayouts(session.role);
    return session;
  }
}
