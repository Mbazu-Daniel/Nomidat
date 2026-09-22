import { Body, Controller, Get, Headers, Param, Post, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { extractHeaders } from "../../common/helpers/auth-http";
import { BusinessAuthService } from "../business/business-auth.service";
import { InitializePaystackPaymentDto } from "./dto";
import { PaystackService } from "./paystack.service";

type RawBodyRequest = Request & { rawBody?: Buffer };

@ApiTags("Payments")
@Controller()
export class PaymentsController {
  constructor(
    private readonly auth: BusinessAuthService,
    private readonly paystack: PaystackService,
  ) {}

  @Post("organizations/:organizationId/payments/paystack/initialize")
  @ApiOperation({ summary: "Initialize a Paystack payment for a sale" })
  async initialize(
    @Param("organizationId") organizationId: string,
    @Body() body: InitializePaystackPaymentDto,
    @Req() req: Request,
  ) {
    await this.auth.authorize(extractHeaders(req), organizationId);
    return this.paystack.initializePayment(organizationId, body);
  }

  @Get("organizations/:organizationId/payments/paystack/:reference/verify")
  @ApiOperation({ summary: "Verify a Paystack payment" })
  async verify(
    @Param("organizationId") organizationId: string,
    @Param("reference") reference: string,
    @Req() req: Request,
  ) {
    await this.auth.authorize(extractHeaders(req), organizationId);
    return this.paystack.verifyPayment(organizationId, reference);
  }

  @Post("payments/paystack/webhook")
  @ApiOperation({ summary: "Receive Paystack payment webhooks" })
  async webhook(
    @Headers("x-paystack-signature") signature: string | undefined,
    @Req() req: RawBodyRequest,
    @Body() body: unknown,
  ) {
    return this.paystack.handleWebhook(signature, req.rawBody ?? Buffer.from(""), body);
  }
}
