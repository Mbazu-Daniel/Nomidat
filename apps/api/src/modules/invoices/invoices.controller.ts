import { ReceiptsService } from "./receipts.service";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { extractHeaders } from "../../common/helpers/auth-http";
import { OrganizationAuthService } from "../organization-summary/organization-auth.service";
import { CreateInvoiceDto, DecideInvoiceOfferDto, UpdateInvoiceDto } from "./dto";
import { InvoiceNegotiationService } from "./invoice-negotiation.service";
import { InvoiceShareService } from "./invoice-share.service";
import { InvoicesService } from "./invoices.service";

@ApiTags("Invoices")
@Controller("organizations/:organizationId")
export class InvoicesController {
  constructor(
    private readonly auth: OrganizationAuthService,
    private readonly invoices: InvoicesService,
    private readonly shares: InvoiceShareService,
    private readonly negotiations: InvoiceNegotiationService,
    private readonly receipts: ReceiptsService,
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
  async getInvoices(
    @Param("organizationId") organizationId: string,
    @Req() req: Request,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
    @Query("offset", new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    await this.authorize(req, organizationId);
    return this.invoices.getInvoices(organizationId, limit, offset);
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

  @Patch("invoices/:invoiceId")
  @ApiOperation({
    summary: "Correct an invoice",
    description: "Refused once the invoice is paid, void or cancelled.",
  })
  @ApiParam({ name: "invoiceId", type: "string", format: "uuid" })
  async updateInvoice(
    @Param("organizationId") organizationId: string,
    @Param("invoiceId") invoiceId: string,
    @Body() body: UpdateInvoiceDto,
    @Req() req: Request,
  ) {
    await this.authorize(req, organizationId);
    return this.invoices.updateInvoice(organizationId, invoiceId, body);
  }

  @Delete("invoices/:invoiceId")
  @ApiOperation({
    summary: "Delete an invoice",
    description: "Refused once the invoice is paid, void or cancelled.",
  })
  @ApiParam({ name: "invoiceId", type: "string", format: "uuid" })
  async removeInvoice(
    @Param("organizationId") organizationId: string,
    @Param("invoiceId") invoiceId: string,
    @Req() req: Request,
  ) {
    await this.authorize(req, organizationId);
    return this.invoices.removeInvoice(organizationId, invoiceId);
  }

  @Post("invoices/:invoiceId/share")
  @ApiOperation({
    summary: "Issue a share link for an invoice",
    description: "Replaces any existing code, which revokes the previous link.",
  })
  @ApiParam({ name: "invoiceId", type: "string", format: "uuid" })
  async shareInvoice(
    @Param("organizationId") organizationId: string,
    @Param("invoiceId") invoiceId: string,
    @Req() req: Request,
  ) {
    await this.authorize(req, organizationId);
    return this.shares.issueShareCode(organizationId, invoiceId);
  }

  @Delete("invoices/:invoiceId/share")
  @ApiOperation({ summary: "Revoke an invoice share link" })
  @ApiParam({ name: "invoiceId", type: "string", format: "uuid" })
  async revokeInvoiceShare(
    @Param("organizationId") organizationId: string,
    @Param("invoiceId") invoiceId: string,
    @Req() req: Request,
  ) {
    await this.authorize(req, organizationId);
    return this.shares.revokeShareCode(organizationId, invoiceId);
  }

  @Get("invoices/:invoiceId/offers")
  @ApiOperation({ summary: "List counter-offers made on an invoice" })
  @ApiParam({ name: "invoiceId", type: "string", format: "uuid" })
  async getInvoiceOffers(
    @Param("organizationId") organizationId: string,
    @Param("invoiceId") invoiceId: string,
    @Req() req: Request,
  ) {
    await this.authorize(req, organizationId);
    return this.negotiations.getForInvoice(organizationId, invoiceId);
  }

  @Post("invoices/:invoiceId/offers/:negotiationId/decision")
  @ApiOperation({
    summary: "Accept or decline a counter-offer",
    description: "Accepting rewrites the invoice total to the agreed amount.",
  })
  @ApiParam({ name: "invoiceId", type: "string", format: "uuid" })
  @ApiParam({ name: "negotiationId", type: "string", format: "uuid" })
  async decideInvoiceOffer(
    @Param("organizationId") organizationId: string,
    @Param("invoiceId") invoiceId: string,
    @Param("negotiationId") negotiationId: string,
    @Body() body: DecideInvoiceOfferDto,
    @Req() req: Request,
  ) {
    const session = await this.authorize(req, organizationId);
    return this.negotiations.decide(organizationId, negotiationId, body.decision, {
      userId: session.userId,
      role: session.role,
    });
  }

  @Get("sales/:saleId/receipt")
  @ApiOperation({ summary: "Get a printable receipt for a sale" })
  async getReceipt(
    @Param("organizationId") organizationId: string,
    @Param("saleId") saleId: string,
    @Req() req: Request,
  ) {
    await this.authorize(req, organizationId);
    return this.receipts.getReceipt(organizationId, saleId);
  }
  /**
   * Returns the session so callers can record who acted in the audit trail.
   * OrganizationAuthService.authorize discards it, so the same checks are re-applied
   * here through getSession + authorizeWrite rather than duplicating the rules.
   */
  private async authorize(req: Request, organizationId: string) {
    const session = await this.auth.getSession(extractHeaders(req), organizationId);
    if (req.method !== "GET") this.auth.authorizeWrite(session.role, "invoices");
    return session;
  }
}
