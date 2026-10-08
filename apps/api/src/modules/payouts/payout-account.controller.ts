import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { assertCanManagePayouts } from "./payout-permissions";
import { extractHeaders } from "../../common/helpers/auth-http";
import { BusinessAuthService } from "../business/business-auth.service";
import { SetPayoutAccountDto, SetPayoutFeeDto } from "./dto/set-payout-account.dto";
import { PayoutAccountService } from "./payout-account.service";
import { PaystackPlatformClient } from "./paystack-platform.client";

/**
 * Where this business's money goes.
 *
 * Gated on the same area as the rest of the shop's commercial settings, since
 * changing a payout destination changes where money physically lands.
 */
@ApiTags("Payouts")
@Controller("organizations/:organizationId/payout-account")
export class PayoutAccountController {
  constructor(
    private readonly auth: BusinessAuthService,
    private readonly accounts: PayoutAccountService,
    private readonly paystack: PaystackPlatformClient,
  ) {}

  @Get("capabilities")
  @ApiOperation({
    summary: "What the platform's Paystack account currently supports",
    description:
      "Dedicated virtual accounts and settlement splits are only available once the platform business is live and Paystack has enabled them. The UI uses this to avoid offering a payment option that would fail.",
  })
  async capabilities(@Param("organizationId") org: string, @Req() req: Request) {
    await this.authorizePayouts(req, org);
    return this.paystack.getCapabilities();
  }

  @Get()
  @ApiOperation({ summary: "This business's payout destination, if set" })
  async get(@Param("organizationId") org: string, @Req() req: Request) {
    await this.authorizePayouts(req, org);
    return this.accounts.get(org);
  }

  @Get("banks")
  @ApiQuery({ name: "currency", required: false })
  @ApiOperation({ summary: "Banks available for payouts" })
  async banks(
    @Param("organizationId") org: string,
    @Req() req: Request,
    @Query("currency") currency?: string,
  ) {
    await this.authorizePayouts(req, org);
    return this.accounts.getBanks(currency ?? "NGN");
  }

  /**
   * Resolving is separate from saving so the owner can see the account name the
   * bank returned before committing to it.
   */
  @Get("resolve")
  @ApiOperation({ summary: "Confirm the owner of an account number" })
  @ApiQuery({ name: "accountNumber", required: true })
  @ApiQuery({ name: "bankCode", required: true })
  async resolve(
    @Param("organizationId") org: string,
    @Req() req: Request,
    @Query("accountNumber") accountNumber: string,
    @Query("bankCode") bankCode: string,
  ) {
    await this.authorizePayouts(req, org);
    return this.accounts.resolve(accountNumber, bankCode);
  }

  @Post()
  @ApiOperation({
    summary: "Set the bank account this business is paid into",
    description:
      "The account name is supplied by the bank, not the caller, and the destination is registered with Paystack as a settlement subaccount.",
  })
  async save(
    @Param("organizationId") org: string,
    @Body() body: SetPayoutAccountDto,
    @Req() req: Request,
  ) {
    await this.authorizePayouts(req, org);
    return this.accounts.save(org, body);
  }

  @Patch("fee")
  @ApiOperation({ summary: "Set the platform's share of each sale, in basis points" })
  async setFee(
    @Param("organizationId") org: string,
    @Body() body: SetPayoutFeeDto,
    @Req() req: Request,
  ) {
    await this.authorizePayouts(req, org);
    return this.accounts.setFeeBps(org, body.platformFeeBps);
  }
  /** Payout changes are owner/admin/manager only, not any writer area. */
  private async authorizePayouts(req: Request, org: string) {
    const session = await this.auth.getSession(extractHeaders(req), org);
    assertCanManagePayouts(session.role);
    return session;
  }
}
