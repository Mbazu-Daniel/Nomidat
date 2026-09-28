import { Body, Controller, ForbiddenException, Get, Param, Put, Req } from "@nestjs/common";
import type { Request } from "express";
import { extractHeaders } from "../../common/helpers/auth-http";
import { BusinessAuthService } from "../business/business-auth.service";
import { BusinessProfileService } from "./business-profile.service";
import { UpdatePaymentKeyDto } from "./dto";

@Controller("organizations/:organizationId/business-profile")
export class BusinessProfileController {
  constructor(
    private readonly auth: BusinessAuthService,
    private readonly profiles: BusinessProfileService,
  ) {}

  @Get()
  async getStatus(@Param("organizationId") org: string, @Req() req: Request) {
    await this.auth.authorize(extractHeaders(req), org);
    return this.profiles.getStatus(org);
  }

  @Put("payment-key")
  async updatePaymentKey(
    @Param("organizationId") org: string,
    @Req() req: Request,
    @Body() body: UpdatePaymentKeyDto,
  ) {
    const session = await this.auth.getSession(extractHeaders(req), org);
    if (!session.role.split(",").some((role) => ["owner", "admin"].includes(role.trim())))
      throw new ForbiddenException("Only owners and admins can manage payment keys.");
    return this.profiles.updatePaymentKey(org, body.secretKey);
  }
}
