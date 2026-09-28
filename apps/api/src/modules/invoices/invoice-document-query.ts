import { NotFoundException } from "@nestjs/common";
import { and, eq } from "@nomidat/db";
import { contact, invoice, invoiceItem, organization } from "@nomidat/db/schema";
import type { DbHandle } from "../../common/db/db.provider";
import { invoiceBusinessDetails, invoiceBusinessLogo } from "./invoice-business";

export async function getInvoiceDocument(
  tx: Pick<DbHandle, "select">,
  organizationId: string,
  invoiceId: string,
) {
  const [result] = await tx
    .select({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: contact.id,
      customer: contact.name,
      customerEmail: contact.email,
      businessName: organization.name,
      businessMetadata: organization.metadata,
      businessLogo: organization.logo,
      status: invoice.status,
      subtotalKobo: invoice.subtotalKobo,
      discountKobo: invoice.discountKobo,
      taxKobo: invoice.taxKobo,
      totalKobo: invoice.totalKobo,
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      pdfUrl: invoice.pdfUrl,
      notes: invoice.notes,
      createdAt: invoice.createdAt,
    })
    .from(invoice)
    .leftJoin(contact, eq(invoice.contactId, contact.id))
    .innerJoin(organization, eq(invoice.organizationId, organization.id))
    .where(and(eq(invoice.id, invoiceId), eq(invoice.organizationId, organizationId)))
    .limit(1);

  if (!result) throw new NotFoundException("Invoice not found.");

  const items = await tx
    .select({
      id: invoiceItem.id,
      productId: invoiceItem.productId,
      description: invoiceItem.description,
      quantity: invoiceItem.quantity,
      unitPriceKobo: invoiceItem.unitPriceKobo,
      totalKobo: invoiceItem.totalKobo,
    })
    .from(invoiceItem)
    .where(eq(invoiceItem.invoiceId, invoiceId));

  const { businessMetadata, businessLogo, ...document } = result;
  return {
    ...document,
    businessLogo: invoiceBusinessLogo(businessLogo),
    businessDetails: invoiceBusinessDetails(businessMetadata),
    items,
  };
}
