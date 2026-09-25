import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  StreamableFile,
} from "@nestjs/common";
import type { Request } from "express";
import { BusinessAuthService } from "../business/business-auth.service";
import { extractHeaders } from "../../common/helpers/auth-http";
import { InvoiceDeliveryService } from "./invoice-delivery.service";
import { SendInvoiceDto } from "./dto";

@Controller()
export class InvoiceDocumentsController {
  constructor(
    private readonly auth: BusinessAuthService,
    private readonly delivery: InvoiceDeliveryService,
  ) {}

  @Get("organizations/:organizationId/invoices/:invoiceId/pdf")
  async getPdf(
    @Param("organizationId", ParseUUIDPipe) org: string,
    @Param("invoiceId", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    await this.auth.authorize(extractHeaders(req), org);
    return new StreamableFile(await this.delivery.getPdf(org, id), {
      type: "application/pdf",
      disposition: `attachment; filename="invoice-${id}.pdf"`,
    });
  }

  @Post("organizations/:organizationId/invoices/:invoiceId/send")
  async createDelivery(
    @Param("organizationId", ParseUUIDPipe) org: string,
    @Param("invoiceId", ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Body() body: SendInvoiceDto,
  ) {
    await this.auth.authorize(extractHeaders(req), org, true, "invoices");
    return this.delivery.createDelivery(org, id, body);
  }

  @Get("invoice-documents/:organizationId/:invoiceId")
  async getSignedPdf(
    @Param("organizationId", ParseUUIDPipe) org: string,
    @Param("invoiceId", ParseUUIDPipe) id: string,
    @Query("expires", ParseIntPipe) expires: number,
    @Query("token") token = "",
  ) {
    return new StreamableFile(await this.delivery.getSignedPdf(org, id, expires, token), {
      type: "application/pdf",
      disposition: "attachment; filename=invoice.pdf",
    });
  }
}
