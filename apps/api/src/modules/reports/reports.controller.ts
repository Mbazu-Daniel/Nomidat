// fallow-ignore-file code-duplication -- controller route signatures intentionally repeat organization/range parameters
import { Controller, Get, Param, ParseIntPipe, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
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
    return this.authorizedRange(
      req,
      organizationId,
      from,
      to,
      (range) => this.reports.getSummary(organizationId, range),
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
    return this.authorizedRange(
      req,
      organizationId,
      from,
      to,
      (range) => this.reports.getSalesTrend(organizationId, range),
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
    return this.authorizedRange(
      req,
      organizationId,
      from,
      to,
      (range) => this.reports.getExpenseBreakdown(organizationId, range),
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
    return this.authorizedRange(
      req,
      organizationId,
      from,
      to,
      (range) => this.reports.getTopProducts(organizationId, range, limit),
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
    return this.authorized(
      req,
      organizationId,
      () => this.reports.getCustomerBalances(organizationId, limit),
    );
  }

  @Get("inventory")
  @ApiOperation({ summary: "Get inventory health and low-stock products" })
  async getInventory(
    @Param("organizationId") organizationId: string,
    @Req() req: Request,
  ) {
    return this.authorized(
      req,
      organizationId,
      () => this.reports.getInventoryHealth(organizationId),
    );
  }

  private authorize(req: Request, organizationId: string): Promise<void> {
    return this.auth.authorize(extractHeaders(req), organizationId);
  }

  private async authorized<T>(
    req: Request,
    organizationId: string,
    action: () => Promise<T>,
  ): Promise<T> {
    await this.authorize(req, organizationId);
    return action();
  }

  private async authorizedRange<T>(
    req: Request,
    organizationId: string,
    from: string | undefined,
    to: string | undefined,
    action: (range: ReturnType<ReportsService["parseRange"]>) => Promise<T>,
  ): Promise<T> {
    await this.authorize(req, organizationId);
    return action(this.reports.parseRange(from, to));
  }
}
