import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/guards/public-route.decorator";
import { ProposeInvoiceOfferDto } from "./dto";
import { InvoiceNegotiationService } from "./invoice-negotiation.service";
import { InvoiceShareService } from "./invoice-share.service";

/**
 * Unauthenticated, by design: this is the route a customer hits from a link in a
 * message. It is deliberately separate from InvoicesController so that sharing
 * state cannot be changed without the seller-side auth check, and so the seller
 * routes never grow an unauthenticated path by accident.
 *
 * `@Public()` states that in the route table rather than in a comment, so the
 * default-deny guard in `AppModule` agrees with the intent. A share code is the
 * only credential here: it is unguessable, scoped to one invoice, and revoking
 * sharing closes the link.
 */
@ApiTags("Public invoices")
@Public()
@Controller("public/invoices")
export class PublicInvoiceController {
  constructor(
    private readonly shares: InvoiceShareService,
    private readonly negotiations: InvoiceNegotiationService,
  ) {}

  @Get(":shareCode")
  @ApiOperation({ summary: "View an invoice via its share link" })
  @ApiParam({ name: "shareCode", description: "The code from a shared invoice link" })
  getSharedInvoice(@Param("shareCode") shareCode: string) {
    return this.shares.getPublicInvoice(shareCode);
  }

  /**
   * An offer is only a proposal. It does not change the amount owed, and the
   * seller has to accept it before any total moves.
   */
  @Post(":shareCode/offers")
  @ApiOperation({
    summary: "Make a counter-offer on a shared invoice",
    description:
      "Records a proposed amount for the seller to consider. The invoice total is unchanged until the seller accepts.",
  })
  @ApiParam({ name: "shareCode", description: "The code from a shared invoice link" })
  async proposeOffer(@Param("shareCode") shareCode: string, @Body() body: ProposeInvoiceOfferDto) {
    return this.negotiations.propose(shareCode, body);
  }
}
