import { and, eq } from "@nomidat/db";
import { contact, invoice, invoiceItem, organization } from "@nomidat/db/schema";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { FileStorageService } from "../../common/files/file-storage.service";
import { randomBytes } from "node:crypto";
import type { PublicInvoiceView } from "./types/public-invoice.type";

/** Bytes of entropy behind a share code. 16 bytes = 128 bits, not enumerable. */
const SHARE_CODE_BYTES = 16;

@Injectable()
export class InvoiceShareService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly files: FileStorageService,
  ) {}
  /**
   * Rotating is the only way to revoke a link already shared, so this is not
   * idempotent.
   */
  async issueShareCode(organizationId: string, invoiceId: string) {
    const shareCode = this.generateShareCode();
    const [updated] = await this.db
      .update(invoice)
      .set({ shareCode, shareEnabled: true, updatedAt: new Date() })
      .where(and(eq(invoice.id, invoiceId), eq(invoice.organizationId, organizationId)))
      .returning({ shareCode: invoice.shareCode, updatedAt: invoice.updatedAt });

    if (!updated?.shareCode) {
      throw new NotFoundException("Invoice not found.");
    }

    return { shareCode: updated.shareCode, updatedAt: updated.updatedAt };
  }

  /** Revokes public access while leaving the invoice intact. */
  async revokeShareCode(organizationId: string, invoiceId: string) {
    const [updated] = await this.db
      .update(invoice)
      .set({ shareEnabled: false, updatedAt: new Date() })
      .where(and(eq(invoice.id, invoiceId), eq(invoice.organizationId, organizationId)))
      .returning({ id: invoice.id });

    if (!updated) throw new NotFoundException("Invoice not found.");
    return { id: updated.id };
  }

  /**
   * A missing, revoked and wrong code all answer with the same 404, so the route
   * cannot be used to probe which codes exist.
   */
  async getPublicInvoice(shareCode: string): Promise<PublicInvoiceView> {
    const [row] = await this.db
      .select({ organizationId: invoice.organizationId })
      .from(invoice)
      .where(and(eq(invoice.shareCode, shareCode), eq(invoice.shareEnabled, true)))
      .limit(1);

    if (!row) {
      throw new NotFoundException("This invoice link is invalid or has been revoked.");
    }

    return this.buildPublicView(row.organizationId, shareCode);
  }

  private generateShareCode(): string {
    return randomBytes(SHARE_CODE_BYTES).toString("base64url");
  }

  private async buildPublicView(
    organizationId: string,
    shareCode: string,
  ): Promise<PublicInvoiceView> {
    const [header] = await this.db
      .select({
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        currency: invoice.currency,
        subtotalMinor: invoice.subtotalMinor,
        discountMinor: invoice.discountMinor,
        taxMinor: invoice.taxMinor,
        totalMinor: invoice.totalMinor,
        dueDate: invoice.dueDate,
        notes: invoice.notes,
        createdAt: invoice.createdAt,
        customerName: contact.name,
        sellerName: organization.name,
        logoKey: organization.logoKey,
        legacyLogo: organization.logo,
      })
      .from(invoice)
      .innerJoin(organization, eq(invoice.organizationId, organization.id))
      .leftJoin(contact, eq(invoice.contactId, contact.id))
      .where(and(eq(invoice.organizationId, organizationId), eq(invoice.shareCode, shareCode)))
      .limit(1);

    if (!header) {
      throw new NotFoundException("This invoice link is invalid or has been revoked.");
    }

    const items = await this.db
      .select({
        description: invoiceItem.description,
        quantity: invoiceItem.quantity,
        unitPriceMinor: invoiceItem.unitPriceMinor,
        totalMinor: invoiceItem.totalMinor,
      })
      .from(invoiceItem)
      .innerJoin(invoice, eq(invoiceItem.invoiceId, invoice.id))
      .where(and(eq(invoice.organizationId, organizationId), eq(invoice.shareCode, shareCode)));

    return {
      invoiceNumber: header.invoiceNumber,
      status: header.status,
      currency: header.currency,
      subtotalMinor: header.subtotalMinor,
      discountMinor: header.discountMinor,
      taxMinor: header.taxMinor,
      totalMinor: header.totalMinor,
      dueDate: header.dueDate,
      notes: header.notes,
      issuedAt: header.createdAt,
      // A URL a browser can render, not a storage key: this route is public and
      // unauthenticated, so it must never hand out anything that names a location
      // in the bucket beyond what the customer's own invoice needs. The legacy
      // inline value still comes through as-is for organizations that predate the
      // bucket, which is the same string they already receive today.
      seller: {
        name: header.sellerName,
        logo: this.files.getPublicUrl(header.logoKey) ?? header.legacyLogo,
      },
      customerName: header.customerName,
      items,
    };
  }
}
