import { Controller, Get, Param, ParseIntPipe, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { extractHeaders } from "../../common/helpers/auth-http";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { BusinessAuthService } from "./business-auth.service";
import { BusinessService } from "./business.service";

@ApiTags("Business")
@Controller("organizations/:organizationId")
export class BusinessController {
  constructor(
    private readonly businessAuthService: BusinessAuthService,
    private readonly businessService: BusinessService,
  ) {}

  @Get("sales")
  @ApiOperation({ summary: "Get recent sales for an organization" })
  @ApiParam({ name: "organizationId", type: "string", format: "uuid" })
  @ApiQuery({ name: "limit", required: false, type: Number, maximum: 50 })
  async getSales(
    @Param("organizationId") organizationId: string,
    @Req() req: Request,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    await this.businessAuthService.authorize(extractHeaders(req), organizationId);
    return this.businessService.getSales(organizationId, limit);
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

  @Get("products")
  @ApiOperation({ summary: "Get current products for an organization" })
  async getProducts(
    @Param("organizationId") organizationId: string,
    @Headers() headers: Headers,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    await this.businessAuthService.authorize(headers, organizationId);
    return this.businessService.getProducts(organizationId, limit);
  }

  @Get("expenses")
  @ApiOperation({ summary: "Get recent expenses for an organization" })
  async getExpenses(
    @Param("organizationId") organizationId: string,
    @Headers() headers: Headers,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    await this.businessAuthService.authorize(headers, organizationId);
    return this.businessService.getExpenses(organizationId, limit);
  }
}
