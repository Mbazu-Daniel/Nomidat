import { and, desc, eq } from "@nomidat/db";
import { AuditService } from "../audit/audit.service";
import { invoice, invoiceNegotiation } from "@nomidat/db/schema";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CLOSED_INVOICE_STATUSES,
  MAX_NEGOTIATION_MESSAGE_LENGTH,
} from "./invoice-negotiation.constants";
import type { NegotiationDecision } from "./invoice-negotiation.constants";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";

/**
 * A proposal never changes what the customer owes: it records an offer only the
 * seller can accept. Anyone holding a share link can propose, so every guard here
 * assumes an untrusted caller.
 */
@Injectable()
export class InvoiceNegotiationService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly audit: AuditService,
  ) {}

  /**
   * Records an offer against a share link. The link is the only credential, so
   * this is deliberately reachable without an account.
   */
  async propose(shareCode: string, input: { proposedTotalMinor: number; message?: string }) {
    const [link] = await this.db
      .select({
        id: invoice.id,
        organizationId: invoice.organizationId,
        totalMinor: invoice.totalMinor,
        status: invoice.status,
      })
      .from(invoice)
      .where(and(eq(invoice.shareCode, shareCode), eq(invoice.shareEnabled, true)))
      .limit(1);

    if (!link) {
      // Same wording as the invoice route, so this cannot be used to find valid codes.
      throw new NotFoundException("This invoice link is invalid or has been revoked.");
    }

    if ((CLOSED_INVOICE_STATUSES as readonly string[]).includes(link.status)) {
      throw new BadRequestException("This invoice is closed to new offers.");
    }

    // An "offer" that asks for more money is not one, and zero is not a price.
    // Both are rejected rather than silently coerced into something payable.
    if (input.proposedTotalMinor <= 0) {
      throw new BadRequestException("Enter an amount greater than zero.");
    }
    if (input.proposedTotalMinor >= link.totalMinor) {
      throw new BadRequestException("An offer must be lower than the invoice total.");
    }

    const [existing] = await this.db
      .select({ id: invoiceNegotiation.id })
      .from(invoiceNegotiation)
      .where(
        and(eq(invoiceNegotiation.invoiceId, link.id), eq(invoiceNegotiation.status, "pending")),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException("There is already an offer awaiting a response.");
    }

    const [created] = await this.db
      .insert(invoiceNegotiation)
      .values({
        organizationId: link.organizationId,
        invoiceId: link.id,
        proposedTotalMinor: input.proposedTotalMinor,
        message: input.message?.trim().slice(0, MAX_NEGOTIATION_MESSAGE_LENGTH) || null,
      })
      .returning({
        id: invoiceNegotiation.id,
        proposedTotalMinor: invoiceNegotiation.proposedTotalMinor,
        status: invoiceNegotiation.status,
        createdAt: invoiceNegotiation.createdAt,
      });

    // The actor is deliberately anonymous: a share link is the only credential.
    await this.audit.record(
      link.organizationId,
      {},
      {
        action: "invoice.offer_proposed",
        entityType: "invoice",
        entityId: link.id,
        metadata: {
          negotiationId: created?.id,
          proposedTotalMinor: input.proposedTotalMinor,
          originalTotalMinor: link.totalMinor,
        },
      },
    );

    return created;
  }

  /** The live offer on an invoice, if any. Shown to the seller and on the public view. */
  async getPending(invoiceId: string, organizationId: string) {
    const [row] = await this.db
      .select({
        id: invoiceNegotiation.id,
        proposedTotalMinor: invoiceNegotiation.proposedTotalMinor,
        message: invoiceNegotiation.message,
        status: invoiceNegotiation.status,
        createdAt: invoiceNegotiation.createdAt,
      })
      .from(invoiceNegotiation)
      .where(
        and(
          eq(invoiceNegotiation.invoiceId, invoiceId),
          eq(invoiceNegotiation.organizationId, organizationId),
          eq(invoiceNegotiation.status, "pending"),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async getForInvoice(organizationId: string, invoiceId: string) {
    return this.db
      .select({
        id: invoiceNegotiation.id,
        proposedTotalMinor: invoiceNegotiation.proposedTotalMinor,
        message: invoiceNegotiation.message,
        status: invoiceNegotiation.status,
        decidedAt: invoiceNegotiation.decidedAt,
        createdAt: invoiceNegotiation.createdAt,
      })
      .from(invoiceNegotiation)
      .where(
        and(
          eq(invoiceNegotiation.invoiceId, invoiceId),
          eq(invoiceNegotiation.organizationId, organizationId),
        ),
      )
      .orderBy(desc(invoiceNegotiation.createdAt));
  }

  /**
   * The seller's decision. Accepting is the only path by which a proposed price
   * becomes binding, which is why it lives here and not in `propose`.
   *
   * The reduction is taken out of `discountMinor` rather than by rewriting line
   * items, so the items a customer was quoted still read correctly on the
   * document and the arithmetic still foots: subtotal - discount + tax = total.
   */
  async decide(
    organizationId: string,
    negotiationId: string,
    decision: NegotiationDecision,
    actor: { userId?: string | null; email?: string | null; role?: string | null },
  ) {
    return this.db.transaction(async (tx) => {
      const [offer] = await tx
        .select({
          id: invoiceNegotiation.id,
          invoiceId: invoiceNegotiation.invoiceId,
          proposedTotalMinor: invoiceNegotiation.proposedTotalMinor,
          status: invoiceNegotiation.status,
        })
        .from(invoiceNegotiation)
        .where(
          and(
            eq(invoiceNegotiation.id, negotiationId),
            eq(invoiceNegotiation.organizationId, organizationId),
          ),
        )
        .for("update")
        .limit(1);

      if (!offer) throw new NotFoundException("Offer not found.");
      if (offer.status !== "pending") {
        throw new ConflictException("This offer has already been decided.");
      }

      const now = new Date();
      await tx
        .update(invoiceNegotiation)
        .set({ status: decision, decidedAt: now, updatedAt: now })
        .where(eq(invoiceNegotiation.id, offer.id));

      if (decision === "accepted") {
        const [target] = await tx
          .select({
            totalMinor: invoice.totalMinor,
            subtotalMinor: invoice.subtotalMinor,
            taxMinor: invoice.taxMinor,
            discountMinor: invoice.discountMinor,
          })
          .from(invoice)
          .where(and(eq(invoice.id, offer.invoiceId), eq(invoice.organizationId, organizationId)))
          .limit(1);

        if (!target) throw new NotFoundException("Invoice not found.");

        // The offer was validated against the total when it was made, but the
        // invoice may have been edited since. Re-check before binding it.
        if (offer.proposedTotalMinor >= target.totalMinor) {
          throw new BadRequestException("This offer is no longer below the invoice total.");
        }

        // Fold the agreed reduction into the existing discount.
        const reduction = target.totalMinor - offer.proposedTotalMinor;
        await tx
          .update(invoice)
          .set({
            totalMinor: offer.proposedTotalMinor,
            discountMinor: target.discountMinor + reduction,
            status: "negotiated",
            updatedAt: now,
          })
          .where(and(eq(invoice.id, offer.invoiceId), eq(invoice.organizationId, organizationId)));
      }

      // Recorded after the transaction commits: a rolled-back decision was not a decision.
      await this.audit.record(organizationId, actor, {
        action: decision === "accepted" ? "invoice.offer_accepted" : "invoice.offer_declined",
        entityType: "invoice",
        entityId: offer.invoiceId,
        metadata: {
          negotiationId: offer.id,
          proposedTotalMinor: offer.proposedTotalMinor,
          decision,
        },
      });

      return { id: offer.id, status: decision };
    });
  }
}
