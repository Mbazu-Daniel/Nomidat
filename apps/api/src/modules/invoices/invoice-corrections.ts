import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { and, eq } from "@nomidat/db";
import { invoice } from "@nomidat/db/schema";
import type { DbHandle } from "../../common/db/db.provider";
import { CLOSED_INVOICE_STATUSES } from "./invoice-negotiation.constants";

/** What an invoice's lines add up to, in minor units, before it is stored. */
export type InvoiceTotals = {
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
};

/** The arithmetic an invoice total is, whether it is being raised or corrected. */
export function invoiceTotals(
  subtotalMinor: number,
  discountMinor: number,
  taxMinor: number,
): InvoiceTotals {
  return {
    subtotalMinor,
    discountMinor,
    taxMinor,
    totalMinor: subtotalMinor - discountMinor + taxMinor,
  };
}

/**
 * The rules a set of totals has to satisfy before any of it is written.
 *
 * `itemCount` is how many lines stand behind the subtotal: zero means an invoice
 * with nothing to bill, which is a different mistake from a wrong number and
 * gets its own message.
 */
export function validateInvoiceTotals(totals: InvoiceTotals, itemCount: number) {
  if (itemCount === 0) {
    throw new BadRequestException("At least one invoice item is required.");
  }
  if (
    !Number.isSafeInteger(totals.subtotalMinor) ||
    totals.subtotalMinor > 2147483647 ||
    totals.totalMinor > 2147483647
  ) {
    throw new BadRequestException("Invoice exceeds the supported amount.");
  }
  if (totals.totalMinor <= 0) {
    throw new BadRequestException("Invoice total must be greater than zero.");
  }
  if (totals.discountMinor > totals.subtotalMinor) {
    throw new BadRequestException("Discount cannot exceed the subtotal.");
  }
}

/**
 * Loads an invoice for a write, holding the row until that write is done.
 *
 * Paid, void and cancelled are the statuses the negotiation service already
 * treats as closed, so one rule covers edit and delete: what a customer has
 * settled, or what has been written off, is not open for correction. The lock is
 * what makes that true against a status changing underneath, rather than merely
 * usually true.
 *
 * Returns the few fields the correction has to re-derive its totals from.
 */
export async function lockOpenInvoice(
  tx: Pick<DbHandle, "select">,
  organizationId: string,
  invoiceId: string,
) {
  const [row] = await tx
    .select({
      status: invoice.status,
      subtotalMinor: invoice.subtotalMinor,
      discountMinor: invoice.discountMinor,
      taxMinor: invoice.taxMinor,
    })
    .from(invoice)
    .where(and(eq(invoice.id, invoiceId), eq(invoice.organizationId, organizationId)))
    .for("update")
    .limit(1);

  if (!row) throw new NotFoundException("Invoice not found.");
  if ((CLOSED_INVOICE_STATUSES as readonly string[]).includes(row.status)) {
    throw new ConflictException(`A ${row.status} invoice cannot be changed.`);
  }
  return row;
}
