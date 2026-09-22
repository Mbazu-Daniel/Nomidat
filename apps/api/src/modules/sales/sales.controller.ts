import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { extractHeaders } from "../../common/helpers/auth-http";
import { BusinessAuthService } from "../business/business-auth.service";
import { SalesService } from "./sales.service";
import { CreateSaleDto, RecordPaymentDto } from "./dto";

@ApiTags("Sales")
@Controller("organizations/:organizationId")
export class SalesController {
  constructor(
    private readonly auth: BusinessAuthService,
    private readonly sales: SalesService,
  ) {}

  @Post("sales")
  @ApiOperation({ summary: "Record a sale" })
  async createSale(
    @Param("organizationId") organizationId: string,
    @Body() body: CreateSaleDto,
    @Req() req: Request,
  ) {
    const session = await this.auth.getSession(extractHeaders(req), organizationId);
    return this.sales.createSale(organizationId, session.userId, body);
  }

  @Get("sales")
  @ApiOperation({ summary: "List sales" })
  @ApiQuery({ name: "limit", required: false, type: Number, maximum: 50 })
  async listSales(
    @Param("organizationId") organizationId: string,
    @Req() req: Request,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    await this.auth.authorize(extractHeaders(req), organizationId);
    return this.sales.listSales(organizationId, limit);
  }

  @Get("sales/:saleId")
  @ApiOperation({ summary: "Get sale details" })
  @ApiParam({ name: "saleId", type: "string", format: "uuid" })
  async getSale(
    @Param("organizationId") organizationId: string,
    @Param("saleId") saleId: string,
    @Req() req: Request,
  ) {
    await this.auth.authorize(extractHeaders(req), organizationId);
    return this.sales.getSale(organizationId, saleId);
  }

  @Post("sales/:saleId/payments")
  @ApiOperation({ summary: "Record a payment against a sale" })
  async recordPayment(
    @Param("organizationId") organizationId: string,
    @Param("saleId") saleId: string,
    @Body() body: RecordPaymentDto,
    @Req() req: Request,
  ) {
    const session = await this.auth.getSession(extractHeaders(req), organizationId);
    return this.sales.recordPayment(organizationId, session.userId, saleId, body);
  }

  @Get("customers/:customerId/balance")
  @ApiOperation({ summary: "Get a customer's outstanding balance" })
  async getCustomerBalance(
    @Param("organizationId") organizationId: string,
    @Param("customerId") customerId: string,
    @Req() req: Request,
  ) {
    await this.auth.authorize(extractHeaders(req), organizationId);
    return this.sales.getCustomerBalance(organizationId, customerId);
  }
}
