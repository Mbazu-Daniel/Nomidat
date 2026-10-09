import { Controller, Get, Param, ParseIntPipe, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { extractHeaders } from "../../common/helpers/auth-http";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { OrganizationAuthService } from "./organization-auth.service";
import { OrganizationSummaryService } from "./organization-summary.service";

@ApiTags("Business")
@Controller("organizations/:organizationId")
export class OrganizationSummaryController {
  constructor(
    private readonly organizationAuth: OrganizationAuthService,
    private readonly organizationSummary: OrganizationSummaryService,
  ) {}

  @Get("access")
  async getAccess(@Param("organizationId") organizationId: string, @Req() req: Request) {
    return this.organizationAuth.getSession(extractHeaders(req), organizationId);
  }

  @Get("summary")
  @ApiOperation({ summary: "Get business summary for an organization" })
  async getSummary(@Param("organizationId") organizationId: string, @Req() req: Request) {
    await this.organizationAuth.authorize(extractHeaders(req), organizationId);
    return this.organizationSummary.getSummary(organizationId);
  }

  @Get("customers")
  @ApiOperation({ summary: "Get recent customers for an organization" })
  async getCustomers(
    @Param("organizationId") organizationId: string,
    @Req() req: Request,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    await this.organizationAuth.authorize(extractHeaders(req), organizationId);
    return this.organizationSummary.getCustomers(organizationId, limit);
  }
}
