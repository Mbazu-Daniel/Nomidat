import { NotFoundException } from "@nestjs/common";
import { and, eq } from "@nomidat/db";
import { contact, product } from "@nomidat/db/schema";
import type { DbHandle } from "../../common/db/db.provider";

/** What an invoice line is once it is about to be inserted. */
type InvoiceLineInput = {
  productId?: string | null;
  description?: string | null;
  productName?: string | null;
  quantity: number;
  unitPriceMinor: number;
  totalMinor?: number;
};

/** The rows behind an invoice's lines, in the order they were sent. */
export function buildInvoiceItems(invoiceId: string, items: InvoiceLineInput[]) {
  return items.map((item) => {
    const { productName, description, totalMinor, ...values } = item;
    return {
      invoiceId,
      ...values,
      description: description ?? productName ?? "Item",
      totalMinor: totalMinor ?? item.quantity * item.unitPriceMinor,
    };
  });
}

/** The customer the invoice is raised against, or null for a cash sale. */
export async function resolveCustomerId(
  tx: Pick<DbHandle, "select">,
  organizationId: string,
  customerId?: string,
) {
  if (!customerId) return null;

  const [customer] = await tx
    .select({ id: contact.id })
    .from(contact)
    .where(and(eq(contact.id, customerId), eq(contact.organizationId, organizationId)))
    .limit(1);

  if (!customer) throw new NotFoundException("Customer not found.");
  return customer.id;
}

/**
 * Every product named on the invoice must belong to this business, so a
 * foreign id cannot be billed from here or used to probe another tenant's
 * catalog.
 */
export async function validateProducts(
  tx: Pick<DbHandle, "select">,
  organizationId: string,
  productIds: Array<string | undefined>,
) {
  const ids = [...new Set(productIds.filter((id): id is string => Boolean(id)))];
  for (const productId of ids) {
    const [row] = await tx
      .select({ id: product.id })
      .from(product)
      .where(and(eq(product.id, productId), eq(product.organizationId, organizationId)))
      .limit(1);
    if (!row) throw new NotFoundException("One or more products were not found.");
  }
}

/**
 * The number printed on the invoice: time-ordered so support can place a
 * call, with a random tail so two invoices in the same millisecond do not
 * collide.
 */
export function nextInvoiceNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${stamp}-${suffix}`;
}
