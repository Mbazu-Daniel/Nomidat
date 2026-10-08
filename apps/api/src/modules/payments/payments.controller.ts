import { Body, Controller, Get, Headers, Param, Post, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { extractHeaders } from "../../common/helpers/auth-http";
import { Public } from "../../common/guards/public-route.decorator";
import { BusinessAuthService } from "../business/business-auth.service";
import { InitializePaystackPaymentDto } from "./dto";
import { PaystackService } from "./providers/paystack/paystack.service";
import { PaymentProviderRegistry } from "./providers/payment-provider-registry.service";
import type { PaystackWebhookRequest } from "./providers/paystack/paystack.interface";

@ApiTags("Payments")
@Controller()
export class PaymentsController {
  constructor(
    private readonly auth: BusinessAuthService,
    private readonly paystack: PaystackService,
    private readonly registry: PaymentProviderRegistry,
  ) {}

  @Get("organizations/:organizationId/payments/providers")
  @ApiOperation({
    summary: "List payment providers and what each one supports",
    description:
      "Clients read this to decide which methods to offer, rather than assuming every provider behaves the same.",
  })
  async getProviders(@Param("organizationId") organizationId: string, @Req() req: Request) {
    await this.auth.authorize(extractHeaders(req), organizationId);
    return this.registry.describe();
  }

  @Post("organizations/:organizationId/payments/paystack/initialize")
  @ApiOperation({ summary: "Initialize a Paystack payment for a sale" })
  async initialize(
    @Param("organizationId") organizationId: string,
    @Body() body: InitializePaystackPaymentDto,
    @Req() req: Request,
  ) {
    await this.auth.authorize(extractHeaders(req), organizationId, true, "sales");
    return this.paystack.initializePayment(organizationId, body);
  }

  @Get("organizations/:organizationId/payments/paystack/:reference/verify")
  @ApiOperation({ summary: "Verify a Paystack payment" })
  async verify(
    @Param("organizationId") organizationId: string,
    @Param("reference") reference: string,
    @Req() req: Request,
  ) {
    await this.auth.authorize(extractHeaders(req), organizationId, true, "sales");
    return this.paystack.verifyPayment(organizationId, reference);
  }

  @Post("payments/paystack/webhook")
  // Paystack signs this with the platform secret rather than a session, so the
  // route is public by design and says so.
  @Public()
  @ApiOperation({ summary: "Receive Paystack payment webhooks" })
  async webhook(
    @Headers("x-paystack-signature") signature: string | undefined,
    @Req() req: Request,
    @Body() body: unknown,
  ) {
    const webhook: PaystackWebhookRequest = {
      signature,
      rawBody: (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(""),
      body,
    };

    return this.paystack.handleWebhook(webhook);
  }
}
