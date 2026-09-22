import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { extractHeaders } from "../../common/helpers/auth-http";
import { BusinessAuthService } from "../business/business-auth.service";
import { CreateInvoiceDto } from "./dto";
import { InvoicesService } from "./invoices.service";

@ApiTags("Invoices")
@Controller("organizations/:organizationId")
export class InvoicesController {
  constructor(
    private readonly auth: BusinessAuthService,
    private readonly invoices: InvoicesService,
  ) {}

  @Post("invoices")
  @ApiOperation({ summary: "Create an invoice" })
  async createInvoice(
    @Param("organizationId") organizationId: string,
    @Body() body: CreateInvoiceDto,
    @Req() req: Request,
  ) {
    await this.authorize(req, organizationId);
    return this.invoices.createInvoice(organizationId, body);
  }

  @Post("invoices/from-sales/:saleId")
  @ApiOperation({ summary: "Create an invoice from a sale" })
  async createFromSale(
    @Param("organizationId") organizationId: string,
    @Param("saleId") saleId: string,
    @Req() req: Request,
  ) {
    await this.authorize(req, organizationId);
    return this.invoices.createFromSale(organizationId, saleId);
  }

  @Get("invoices")
  @ApiOperation({ summary: "List invoices" })
  @ApiQuery({ name: "limit", required: false, type: Number, maximum: 50 })
  async listInvoices(
    @Param("organizationId") organizationId: string,
    @Req() req: Request,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    await this.authorize(req, organizationId);
    return this.invoices.listInvoices(organizationId, limit);
  }

  @Get("invoices/:invoiceId")
  @ApiOperation({ summary: "Get invoice details" })
  @ApiParam({ name: "invoiceId", type: "string", format: "uuid" })
  async getInvoice(
    @Param("organizationId") organizationId: string,
    @Param("invoiceId") invoiceId: string,
    @Req() req: Request,
  ) {
    await this.authorize(req, organizationId);
    return this.invoices.getInvoice(organizationId, invoiceId);
  }

  @Get("sales/:saleId/receipt")
  @ApiOperation({ summary: "Get a printable receipt for a sale" })
  async getReceipt(
    @Param("organizationId") organizationId: string,
    @Param("saleId") saleId: string,
    @Req() req: Request,
  ) {
    await this.authorize(req, organizationId);
    return this.invoices.getReceipt(organizationId, saleId);
  }
  private authorize(req: Request, organizationId: string) {
    return this.auth.authorize(extractHeaders(req), organizationId);
  }
}
