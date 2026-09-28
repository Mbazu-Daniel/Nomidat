import { Controller, Get, Param, ParseIntPipe, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { extractHeaders } from "../../common/helpers/auth-http";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { BusinessAuthService } from "./business-auth.service";
import { BusinessService } from "./business.service";

@ApiTags("Business")
@Controller("organizations/:organizationId")
export class BusinessController {
  constructor(
    private readonly businessAuthService: BusinessAuthService,
    private readonly businessService: BusinessService,
  ) {}

  @Get("access")
  async getAccess(@Param("organizationId") organizationId: string, @Req() req: Request) {
    return this.businessAuthService.getSession(extractHeaders(req), organizationId);
  }

  @Get("summary")
  @ApiOperation({ summary: "Get business summary for an organization" })
  async getSummary(@Param("organizationId") organizationId: string, @Req() req: Request) {
    await this.businessAuthService.authorize(extractHeaders(req), organizationId);
    return this.businessService.getSummary(organizationId);
  }

  @Get("customers")
  @ApiOperation({ summary: "Get recent customers for an organization" })
  async getCustomers(
    @Param("organizationId") organizationId: string,
    @Req() req: Request,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    await this.businessAuthService.authorize(extractHeaders(req), organizationId);
    return this.businessService.getCustomers(organizationId, limit);
  }
}
