import { Controller, Get, Param, ParseIntPipe, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { extractHeaders } from "../../common/helpers/auth-http";
import { BusinessAuthService } from "../business/business-auth.service";
import { ReportsService } from "./reports.service";

@ApiTags("Reports")
@Controller("organizations/:organizationId/reports")
export class ReportsController {
  constructor(
    private readonly auth: BusinessAuthService,
    private readonly reports: ReportsService,
  ) {}

  @Get("summary")
  @ApiOperation({ summary: "Get sales, collections, expenses and credit summary" })
  async getSummary(
    @Param("organizationId") organizationId: string,
    @Req() req: Request,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    await this.auth.authorize(extractHeaders(req), organizationId);
    return this.reports.getSummary(
      organizationId,
      this.reports.parseRange(from, to),
    );
  }

  @Get("sales")
  @ApiOperation({ summary: "Get daily sales trend" })
  @ApiQuery({ name: "from", required: false, type: String })
  @ApiQuery({ name: "to", required: false, type: String })
  async getSales(
    @Param("organizationId") organizationId: string,
    @Req() req: Request,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    await this.auth.authorize(extractHeaders(req), organizationId);
    return this.reports.getSalesTrend(
      organizationId,
      this.reports.parseRange(from, to),
    );
  }

  @Get("expenses")
  @ApiOperation({ summary: "Get expense breakdown by category" })
  async getExpenses(
    @Param("organizationId") organizationId: string,
    @Req() req: Request,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    await this.auth.authorize(extractHeaders(req), organizationId);
    return this.reports.getExpenseBreakdown(
      organizationId,
      this.reports.parseRange(from, to),
    );
  }

  @Get("products")
  @ApiOperation({ summary: "Get top-selling products" })
  @ApiQuery({ name: "limit", required: false, type: Number, maximum: 20 })
  async getProducts(
    @Param("organizationId") organizationId: string,
    @Req() req: Request,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    await this.auth.authorize(extractHeaders(req), organizationId);
    return this.reports.getTopProducts(
      organizationId,
      this.reports.parseRange(from, to),
      limit,
    );
  }

  @Get("customers")
  @ApiOperation({ summary: "Get customers with outstanding balances" })
  @ApiQuery({ name: "limit", required: false, type: Number, maximum: 50 })
  async getCustomers(
    @Param("organizationId") organizationId: string,
    @Req() req: Request,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    await this.auth.authorize(extractHeaders(req), organizationId);
    return this.reports.getCustomerBalances(organizationId, limit);
  }

  @Get("inventory")
  @ApiOperation({ summary: "Get inventory health and low-stock products" })
  async getInventory(
    @Param("organizationId") organizationId: string,
    @Req() req: Request,
  ) {
    await this.auth.authorize(extractHeaders(req), organizationId);
    return this.reports.getInventoryHealth(organizationId);
  }
}
